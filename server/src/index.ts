import { config, ensureDataDirs, resolveJwtSecret } from './config';
import { createApp } from './app';
import { ensureAdmin, seedExamples } from './bootstrap';
import { initFileLogging, logger } from './lib/logger';
import { configureSqlite, prisma } from './lib/prisma';
import { purgeDeletedBoardPosts } from './routes/board';

async function main() {
  ensureDataDirs();
  initFileLogging();
  resolveJwtSecret();
  await configureSqlite();
  await ensureAdmin();
  await seedExamples();

  // Papierkorb der Infotafel: nach 90 Tagen endgültig löschen (beim Start und danach alle 12 Stunden)
  const purge = () => purgeDeletedBoardPosts().catch((err) => logger.error('Infotafel-Bereinigung fehlgeschlagen', err));
  await purge();
  setInterval(purge, 12 * 60 * 60 * 1000).unref();

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Zauberbuch ${config.version} läuft auf Port ${config.port} (Daten: ${config.dataDir})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} empfangen, fahre herunter …`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Start fehlgeschlagen', err);
  process.exit(1);
});
