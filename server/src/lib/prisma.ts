import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** SQLite für parallele Lese-/Schreibzugriffe optimieren. */
export async function configureSqlite(): Promise<void> {
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
}
