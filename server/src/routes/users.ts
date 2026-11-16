import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@zauberbuch/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, conflict, notFound } from '../lib/errors';
import { hashPassword } from '../lib/auth';
import { toUserDto } from '../lib/users';
import { requireAdmin } from '../middleware/auth';

/** Benutzerverwaltung – nur Admin. Benutzer werden ausschließlich hier angelegt. */
export const usersRouter = Router();

usersRouter.use(requireAdmin);

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { favorites: true } } },
  });
  res.json({
    users: users.map((u) => ({ ...toUserDto(u), favoriteCount: u._count.favorites })),
  });
});

usersRouter.post('/', async (req, res) => {
  const input = validate(createUserSchema, req.body);
  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, ...(input.email ? [{ email: input.email }] : [])] },
  });
  if (existing) {
    throw conflict(existing.username === input.username ? 'username_taken' : 'email_taken', 'User already exists');
  }
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email ?? null,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      language: input.language ?? config.defaultLanguage,
    },
  });
  res.status(201).json({ user: { ...toUserDto(user), favoriteCount: 0 } });
});

usersRouter.patch('/:id', async (req, res) => {
  const { role, password } = validate(updateUserSchema, req.body);
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) throw notFound('user_not_found', 'User not found');
  if (role && user.role === 'admin' && role !== 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) throw badRequest('last_admin', 'The last admin cannot be demoted');
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(role ? { role } : {}),
      // Neues Passwort meldet alle Sitzungen des Benutzers ab
      ...(password ? { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } } : {}),
    },
  });
  res.json({ user: toUserDto(updated) });
});

usersRouter.delete('/:id', async (req, res) => {
  if (String(req.params.id) === req.user!.id) throw badRequest('cannot_delete_self', 'You cannot delete yourself');
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) throw notFound('user_not_found', 'User not found');
  if (user.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) throw badRequest('last_admin', 'The last admin cannot be deleted');
  }
  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).end();
});
