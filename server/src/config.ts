import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Locale } from '@zauberbuch/shared';

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

const dataDir = path.resolve(process.env.DATA_DIR || '/data');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 8080),
  dataDir,
  logDir: path.join(dataDir, 'logs'),
  uploadDir: path.join(dataDir, 'uploads'),
  backupDir: path.join(dataDir, 'backups'),
  allowRegistration: bool(process.env.ALLOW_REGISTRATION, true),
  defaultLanguage: (process.env.DEFAULT_LANGUAGE === 'en' ? 'en' : 'de') as Locale,
  seedExamples: bool(process.env.SEED_EXAMPLES, false),
  adminUsername: process.env.ADMIN_USERNAME?.trim() || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminEmail: process.env.ADMIN_EMAIL?.trim() || '',
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieMaxAgeMs: int(process.env.COOKIE_MAX_AGE_DAYS, 7) * 24 * 60 * 60 * 1000,
  trustProxy: process.env.TRUST_PROXY ?? '1',
  authRateLimitMax: int(process.env.AUTH_RATE_LIMIT_MAX, 10),
  authRateLimitWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MIN, 15) * 60 * 1000,
  logToFile: bool(process.env.LOG_TO_FILE, true),
  version: process.env.APP_VERSION || '1.0.0',
  clientDist: process.env.CLIENT_DIST
    ? path.resolve(process.env.CLIENT_DIST)
    : path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '../../client/dist'),
  jwtSecret: process.env.JWT_SECRET?.trim() || '',
};

export function ensureDataDirs(): void {
  for (const dir of [config.dataDir, config.logDir, config.uploadDir, config.backupDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * JWT_SECRET aus der Umgebung verwenden; ist es leer, wird beim ersten Start ein zufälliges
 * Secret erzeugt und unter /data/jwt_secret gespeichert, damit Sitzungen Neustarts überleben.
 */
export function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) {
    config.jwtSecret = fromEnv;
    return fromEnv;
  }
  const file = path.join(config.dataDir, 'jwt_secret');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 32) {
      config.jwtSecret = existing;
      return existing;
    }
  } catch {
    // Datei existiert noch nicht
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  config.jwtSecret = secret;
  return secret;
}
