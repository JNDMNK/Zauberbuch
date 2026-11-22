import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { config } from '../config';
import { badRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';
import { ensureAdmin } from '../bootstrap';
import { seedCatalog } from './catalog';
import { backfillBackgroundFields, backfillSubclassSources, seedWiki } from './wiki';

/**
 * Gesamt-Export / -Import (nur Admin): alle Tabellen der Datenbank als eine JSON-Datei – Zauber, Benutzer (inkl.
 * Passwort-Hashes), Charakterbögen mit Bildern, Geschichten, Infotafel, Kampf, Bestiarium, Wiki, Gegenstände, Quellen …
 * Werte werden roh über SQLite-JSON übertragen, damit Typen (Zahl/Text, Datumsformate) exakt erhalten bleiben.
 */
export const backupRouter = Router();

export const BACKUP_FORMAT = 'zauberbuch-backup';
const largeJson = express.json({ limit: '500mb' });
const SKIP_TABLES = new Set(['_prisma_migrations']);
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

interface Column {
  name: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

async function tables(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  return rows.map((r) => r.name).filter((n) => !SKIP_TABLES.has(n));
}

async function columns(table: string): Promise<Column[]> {
  return prisma.$queryRawUnsafe<Column[]>(`PRAGMA table_info(${ident(table)})`);
}

/** Name der zuletzt angewendeten Migration (Stand des Datenbankschemas) */
async function currentMigration(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
      'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1',
    );
    return rows[0]?.migration_name ?? null;
  } catch {
    return null;
  }
}

backupRouter.get('/export', requireAdmin, async (req, res) => {
  const out: Record<string, unknown[]> = {};
  for (const table of await tables()) {
    const cols = await columns(table);
    if (cols.length === 0) continue;
    const obj = cols.map((c) => `'${c.name.replace(/'/g, "''")}', ${ident(c.name)}`).join(', ');
    const rows = await prisma.$queryRawUnsafe<{ j: string | null }[]>(`SELECT json_group_array(json_object(${obj})) AS j FROM ${ident(table)}`);
    out[table] = JSON.parse(rows[0]?.j ?? '[]');
  }
  const now = new Date();
  logger.info(`Gesamt-Export durch ${req.user!.username}`);
  res.setHeader('Content-Disposition', `attachment; filename="zauberbuch-gesamt-${now.toISOString().slice(0, 10)}.json"`);
  res.json({ format: BACKUP_FORMAT, version: 1, appVersion: config.version, migration: await currentMigration(), exportedAt: now.toISOString(), tables: out });
});

backupRouter.post('/import', requireAdmin, largeJson, async (req, res) => {
  const body = req.body as { backup?: unknown; confirm?: unknown };
  if (body?.confirm !== true) throw badRequest('confirm_required', 'Import must be confirmed');
  const backup = body.backup as { format?: unknown; version?: unknown; migration?: unknown; tables?: unknown } | undefined;
  if (!backup || backup.format !== BACKUP_FORMAT || backup.version !== 1 || !backup.tables || typeof backup.tables !== 'object' || Array.isArray(backup.tables)) {
    throw badRequest('backup_invalid', 'Not a Zauberbuch backup file');
  }
  const data = backup.tables as Record<string, unknown>;
  // Sicherung aus einer neueren Version (Schema mit späteren Migrationen) lässt sich nicht sicher einspielen
  const current = await currentMigration();
  if (typeof backup.migration === 'string' && current && backup.migration > current) throw badRequest('backup_newer', 'Backup is from a newer version');

  const known = await tables();
  for (const [name, rows] of Object.entries(data)) {
    if (known.includes(name) && (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== 'object' || Array.isArray(r)))) throw badRequest('backup_invalid', `Invalid rows for ${name}`);
  }

  // Sicherheitskopie der aktuellen Datenbank, bevor sie ersetzt wird
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  let safety = path.join(config.backupDir, `vor-import-${stamp}.db`);
  for (let n = 2; fs.existsSync(safety); n++) safety = path.join(config.backupDir, `vor-import-${stamp}-${n}.db`);
  try {
    fs.mkdirSync(config.backupDir, { recursive: true });
    await prisma.$executeRawUnsafe(`VACUUM INTO '${safety.replace(/'/g, "''")}'`);
  } catch (err) {
    logger.error(`Sicherheitskopie vor dem Import fehlgeschlagen: ${(err as Error).message}`);
    throw badRequest('backup_safety_failed', 'Could not create a safety copy');
  }

  const counts: Record<string, number> = {};
  const ignored = Object.keys(data).filter((n) => !known.includes(n));
  try {
    await prisma.$transaction(
      async (tx) => {
        // Fremdschlüssel erst am Ende der Transaktion prüfen: Reihenfolge der Tabellen spielt keine Rolle
        await tx.$executeRawUnsafe('PRAGMA defer_foreign_keys = ON');
        for (const table of known) await tx.$executeRawUnsafe(`DELETE FROM ${ident(table)}`);
        for (const table of known) {
          const rows = (data[table] ?? []) as Record<string, unknown>[];
          counts[table] = rows.length;
          if (rows.length === 0) continue;
          // Nur Spalten, die es (noch) gibt; fehlende Spalten älterer Sicherungen erhalten ihren Standardwert
          const present = new Set(rows.flatMap((r) => Object.keys(r)));
          const cols = (await columns(table)).map((c) => c.name).filter((c) => present.has(c));
          if (cols.length === 0) continue;
          const select = cols.map((c) => `json_extract(value, '$."${c.replace(/'/g, "''").replace(/"/g, '\\"')}"')`).join(', ');
          for (let i = 0; i < rows.length; i += 500) {
            await tx.$executeRawUnsafe(`INSERT INTO ${ident(table)} (${cols.map(ident).join(', ')}) SELECT ${select} FROM json_each(?)`, JSON.stringify(rows.slice(i, i + 500)));
          }
        }
      },
      { timeout: 300_000, maxWait: 20_000 },
    );
  } catch (err) {
    logger.error(`Gesamt-Import fehlgeschlagen: ${(err as Error).message}`);
    throw badRequest('backup_import_failed', (err as Error).message.split('\n').slice(-1)[0].slice(0, 300));
  }

  // Wie beim Start: Admin aus der Umgebung sicherstellen, fehlende Grundausstattung ergänzen
  await ensureAdmin();
  await seedCatalog();
  await seedWiki();
  await backfillSubclassSources();
  await backfillBackgroundFields();
  logger.info(`Gesamt-Import durch ${req.user!.username}: ${Object.values(counts).reduce((a, b) => a + b, 0)} Datensätze, Sicherung: ${safety}`);
  res.json({ counts, ignored, safetyCopy: path.basename(safety) });
});
