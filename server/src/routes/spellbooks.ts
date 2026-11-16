import { Router } from 'express';
import type { Role, SpellbookOwnerDto } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { requireEditor } from '../middleware/auth';

/** Übersicht der Zauberbücher (Favoriten) aller Benutzer – für Admin und Dungeon Master. */
export const spellbooksRouter = Router();

spellbooksRouter.use(requireEditor);

spellbooksRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { username: 'asc' },
    select: { id: true, username: true, role: true, _count: { select: { favorites: true } } },
  });
  const owners: SpellbookOwnerDto[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role as Role,
    spellCount: u._count.favorites,
  }));
  res.json({ owners });
});
