import type { NextFunction, Request, Response } from 'express';
import type { User } from '@prisma/client';
import { isEditorRole } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { AUTH_COOKIE, verifyToken } from '../lib/auth';
import { forbidden, unauthorized } from '../lib/errors';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Lädt den Benutzer aus dem JWT-Cookie (falls vorhanden und gültig). */
export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (typeof token === 'string' && token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user && user.tokenVersion === payload.tv) req.user = user;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'admin') return next(forbidden());
  next();
}

/** Admin oder Dungeon Master: Zauber pflegen und Zauberbücher aller Benutzer sehen. */
export function requireEditor(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (!isEditorRole(req.user.role)) return next(forbidden());
  next();
}

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'zauberbuch';

/**
 * CSRF-Schutz zusätzlich zu SameSite=Lax-Cookies: Alle schreibenden API-Anfragen müssen den
 * Header "X-Requested-With: zauberbuch" senden. Fremde Seiten können diesen Header ohne
 * CORS-Freigabe nicht setzen.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get(CSRF_HEADER) !== CSRF_VALUE) {
    return next(forbidden('csrf_failed', 'Missing or invalid CSRF header'));
  }
  next();
}
