import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Response, Request } from 'express';
import { config } from '../config';

export const AUTH_COOKIE = 'zb_token';

export interface TokenPayload {
  sub: string;
  tv: number;
}

export const hashPassword = (password: string) => bcrypt.hash(password, config.bcryptRounds);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, tv: tokenVersion } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (typeof payload === 'object' && typeof payload.sub === 'string' && typeof payload.tv === 'number') {
      return { sub: payload.sub, tv: payload.tv };
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Hinter einem HTTPS-Reverse-Proxy (trust proxy) ist req.secure true
    secure: req.secure,
    maxAge: config.cookieMaxAgeMs,
    path: '/',
  });
}

export function clearAuthCookie(req: Request, res: Response): void {
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' });
}
