import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { avatarSchema, changePasswordSchema, loginSchema, updateMeSchema } from '@zauberbuch/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { clearAuthCookie, hashPassword, setAuthCookie, signToken, verifyPassword } from '../lib/auth';
import { badRequest, HttpError, unauthorized } from '../lib/errors';
import { toUserDto } from '../lib/users';
import { requireAuth } from '../middleware/auth';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  limit: config.authRateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new HttpError(429, 'too_many_requests', 'Too many attempts, please try again later')),
});

// Dummy-Hash, damit Login-Antwortzeiten nicht verraten, ob ein Benutzer existiert
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword('zauberbuch-dummy-password'));

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = validate(loginSchema, req.body);
  const identifier = input.identifier;
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier.toLowerCase() }] },
  });
  const valid = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw unauthorized('invalid_credentials', 'Invalid username or password');
  setAuthCookie(req, res, signToken(user.id, user.tokenVersion));
  res.json({ user: toUserDto(user) });
});

authRouter.post('/logout', (req, res) => {
  clearAuthCookie(req, res);
  res.status(204).end();
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? toUserDto(req.user) : null });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const input = validate(updateMeSchema, req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { language: input.language },
  });
  res.json({ user: toUserDto(user) });
});

/** Eigenes Profilbild setzen bzw. entfernen (avatar: null) */
authRouter.put('/me/avatar', requireAuth, async (req, res) => {
  const { avatar } = validate(avatarSchema, req.body);
  const me = req.user!.id;
  const user = avatar
    ? await prisma.user.update({ where: { id: me }, data: { avatarUpdatedAt: new Date(), avatar: { upsert: { create: { data: avatar }, update: { data: avatar } } } } })
    : await prisma.user.update({ where: { id: me }, data: { avatarUpdatedAt: null, avatar: { delete: (await prisma.userAvatar.count({ where: { userId: me } })) > 0 } } });
  res.json({ user: toUserDto(user) });
});

authRouter.post('/password', requireAuth, authLimiter, async (req, res) => {
  const input = validate(changePasswordSchema, req.body);
  const current = req.user!;
  if (!(await verifyPassword(input.currentPassword, current.passwordHash))) {
    throw badRequest('wrong_password', 'Current password is incorrect');
  }
  const user = await prisma.user.update({
    where: { id: current.id },
    data: { passwordHash: await hashPassword(input.newPassword), tokenVersion: { increment: 1 } },
  });
  // Neues Token ausstellen – alle anderen Sitzungen werden ungültig
  setAuthCookie(req, res, signToken(user.id, user.tokenVersion));
  res.json({ user: toUserDto(user) });
});
