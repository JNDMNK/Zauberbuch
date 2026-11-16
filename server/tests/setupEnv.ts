import { TEST_DB, TMP_DIR } from './paths';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.DATA_DIR = TMP_DIR;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'admin-password';
process.env.ALLOW_REGISTRATION = 'true';
process.env.BCRYPT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.LOG_TO_FILE = 'false';
process.env.CLIENT_DIST = `${TMP_DIR}/no-client`;
