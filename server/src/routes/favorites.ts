import { Router } from 'express';
import { favoriteSchema } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { notFound } from '../lib/errors';
import { requireAuth } from '../middleware/auth';

export const favoritesRouter = Router();

favoritesRouter.use(requireAuth);

favoritesRouter.get('/', async (req, res) => {
  const favs = await prisma.favorite.findMany({
    where: { userId: req.user!.id },
    select: { spellId: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ spellIds: favs.map((f) => f.spellId) });
});

favoritesRouter.post('/', async (req, res) => {
  const { spellId } = validate(favoriteSchema, req.body);
  const spell = await prisma.spell.findUnique({ where: { id: spellId }, select: { id: true } });
  if (!spell) throw notFound('spell_not_found', 'Spell not found');
  await prisma.favorite.upsert({
    where: { userId_spellId: { userId: req.user!.id, spellId } },
    create: { userId: req.user!.id, spellId },
    update: {},
  });
  res.status(201).json({ spellId, isFavorite: true });
});

favoritesRouter.delete('/:spellId', async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, spellId: String(req.params.spellId) } });
  res.status(204).end();
});
