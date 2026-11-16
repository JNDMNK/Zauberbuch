import { Router } from 'express';
import { updateUserSchema } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, notFound } from '../lib/errors';
import { toUserDto } from '../lib/users';
import { requireAdmin } from '../middleware/auth';

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

usersRouter.patch('/:id', async (req, res) => {
  const { role } = validate(updateUserSchema, req.body);
  const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!user) throw notFound('user_not_found', 'User not found');
  if (user.role === 'admin' && role !== 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) throw badRequest('last_admin', 'The last admin cannot be demoted');
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { role } });
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
