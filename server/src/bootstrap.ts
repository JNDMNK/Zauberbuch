import { spellInputSchema } from '@zauberbuch/shared';
import { config } from './config';
import { hashPassword } from './lib/auth';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createSpell } from './lib/spells';
import { exampleSpells } from './seed-data';

/** Legt den ersten Admin aus ADMIN_USERNAME / ADMIN_PASSWORD an, falls noch keiner existiert. */
export async function ensureAdmin(): Promise<void> {
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (adminCount > 0) return;
  if (!config.adminUsername || !config.adminPassword) {
    logger.warn('Kein Admin vorhanden und ADMIN_USERNAME/ADMIN_PASSWORD nicht gesetzt – Admin-Bereich ist nicht erreichbar.');
    return;
  }
  if (config.adminPassword.length < 8) {
    logger.warn('ADMIN_PASSWORD ist kürzer als 8 Zeichen – bitte nach dem ersten Login ändern.');
  }
  const existing = await prisma.user.findUnique({ where: { username: config.adminUsername } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'admin' } });
    logger.info(`Benutzer "${existing.username}" wurde zum Admin befördert.`);
    return;
  }
  await prisma.user.create({
    data: {
      username: config.adminUsername,
      email: config.adminEmail || null,
      passwordHash: await hashPassword(config.adminPassword),
      role: 'admin',
      language: config.defaultLanguage,
    },
  });
  logger.info(`Admin "${config.adminUsername}" wurde angelegt.`);
}

/** Legt die Beispielzauber an, wenn SEED_EXAMPLES=true und die Datenbank noch keine Zauber enthält. */
export async function seedExamples(force = false): Promise<number> {
  if (!force && !config.seedExamples) return 0;
  if ((await prisma.spell.count()) > 0) return 0;
  let created = 0;
  for (const raw of exampleSpells) {
    const input = spellInputSchema.parse(raw);
    await createSpell(input);
    created++;
  }
  logger.info(`${created} Beispielzauber angelegt.`);
  return created;
}
