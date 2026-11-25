import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { Prisma } from '@prisma/client';
import type { AppConfigDto } from '@zauberbuch/shared';
import { config } from './config';
import { HttpError } from './lib/errors';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { csrfProtection, loadUser, requireAuth } from './middleware/auth';
import { authRouter } from './routes/auth';
import { spellsRouter } from './routes/spells';
import { favoritesRouter } from './routes/favorites';
import { usersRouter } from './routes/users';
import { spellbooksRouter } from './routes/spellbooks';
import { charactersRouter } from './routes/characters';
import { boardRouter } from './routes/board';
import { combatRouter } from './routes/combat';
import { notificationsRouter } from './routes/notifications';
import { bestiaryRouter } from './routes/bestiary';
import { storiesRouter } from './routes/stories';
import { itemsRouter } from './routes/items';
import { catalogRouter } from './routes/catalog';
import { dmNotesRouter } from './routes/dmnotes';
import { wikiRouter } from './routes/wiki';
import { sourcesRouter } from './routes/sources';
import { backupRouter } from './routes/backup';
import { chatRouter } from './routes/chat';
import { addClient } from './lib/events';

const LARGE_BODY_PATHS = new Set(['/api/characters/import', '/api/characters/import/preview', '/api/backup/import']);

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

export function createApp(options: { accessLog?: boolean } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Hinter Nginx Proxy Manager / SWAG: X-Forwarded-* auswerten (Protokoll, Client-IP)
  app.set('trust proxy', parseTrustProxy(config.trustProxy));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          // blob: für die Vorschau/Verkleinerung hochgeladener Bilder im Browser (Charakterbogen)
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'script-src': ["'self'"],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          // Die App wird im LAN oft per http://IP:PORT aufgerufen – kein Zwangs-Upgrade auf HTTPS
          'upgrade-insecure-requests': null,
        },
      },
      // HSTS übernimmt bei Bedarf der Reverse Proxy
      strictTransportSecurity: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  if (options.accessLog !== false) {
    app.use(morgan(':remote-addr :method :url :status :res[content-length] - :response-time ms', { stream: logger.stream }));
  }

  const jsonParser = express.json({ limit: '12mb' });
  // Charakter-Import parst seinen (evtl. großen) Body selbst – erst nach der Admin-Prüfung
  app.use((req, res, next) => (LARGE_BODY_PATHS.has(req.path) ? next() : jsonParser(req, res, next)));
  app.use(cookieParser());

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', version: config.version, time: new Date().toISOString() });
    } catch (err) {
      logger.error('Healthcheck failed', err);
      res.status(503).json({ status: 'error' });
    }
  });

  api.use(csrfProtection);
  api.use(loadUser);

  api.get('/config', (_req, res) => {
    const body: AppConfigDto = {
      defaultLanguage: config.defaultLanguage,
      version: config.version,
    };
    res.json(body);
  });

  api.use('/auth', authRouter);
  api.use('/spells', spellsRouter);
  api.use('/favorites', favoritesRouter);
  api.use('/users', usersRouter);
  api.use('/spellbooks', spellbooksRouter);
  api.use('/characters', charactersRouter);
  api.use('/board', boardRouter);
  api.use('/combat', combatRouter);
  api.use('/notifications', notificationsRouter);
  api.use('/bestiary', bestiaryRouter);
  api.use('/stories', storiesRouter);
  api.use('/items', itemsRouter);
  api.use('/catalog', catalogRouter);
  api.use('/dm-notes', dmNotesRouter);
  api.use('/wiki', wikiRouter);
  api.use('/backup', backupRouter);
  api.use('/chat', chatRouter);
  api.get('/events', requireAuth, (req, res) => addClient(req.user!, res));
  api.use('/sources', sourcesRouter);

  api.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'API route not found')));

  app.use('/api', api);

  // Gebautes Frontend statisch ausliefern + SPA-Fallback
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(config.clientDist, 'assets'), { immutable: true, maxAge: '1y', index: false }),
    );
    app.use(express.static(config.clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}

function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'conflict', message: 'Unique constraint violated' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
      return;
    }
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON body' } });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body too large' } });
    return;
  }
  logger.error('Unhandled error', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal server error' } });
}
