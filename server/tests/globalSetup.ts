import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TEST_DB, TMP_DIR } from './paths';

export default function setup() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
    stdio: 'pipe',
  });
  return () => fs.rmSync(TMP_DIR, { recursive: true, force: true });
}
