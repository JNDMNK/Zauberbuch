import path from 'node:path';

export const TMP_DIR = path.resolve(import.meta.dirname, '.tmp');
export const TEST_DB = path.join(TMP_DIR, 'test.db');
