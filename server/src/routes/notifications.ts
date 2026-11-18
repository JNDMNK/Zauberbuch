import { Router } from 'express';
import { z } from 'zod';
import type { NotificationDto } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { requireAuth } from '../middleware/auth';

/** Eigene Benachrichtigungen (Glocke in der Kopfzeile) */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function parseData(raw: string): Record<string, string> {
  try {
    const d = JSON.parse(raw);
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}

notificationsRouter.get('/', async (req, res) => {
  const [list, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
  ]);
  const notifications: NotificationDto[] = list.map((n) => ({
    id: n.id,
    type: n.type,
    data: parseData(n.data),
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  }));
  res.json({ notifications, unread });
});

/** Alle (oder die angegebenen) als gelesen markieren */
notificationsRouter.post('/read', async (req, res) => {
  const { ids } = validate(z.object({ ids: z.array(z.string().max(64)).max(200).optional() }), req.body ?? {});
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  res.status(204).end();
});

/** Alle eigenen Benachrichtigungen löschen */
notificationsRouter.delete('/', async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
  res.status(204).end();
});
