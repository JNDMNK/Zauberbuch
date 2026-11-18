import type { Role } from '@zauberbuch/shared';
import { prisma } from './prisma';
import { logger } from './logger';

/** Benachrichtigung an alle Benutzer einer Rolle */
export async function notifyRole(role: Role, type: string, data: Record<string, string>) {
  const users = await prisma.user.findMany({ where: { role }, select: { id: true } });
  if (users.length === 0) return 0;
  await prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type, data: JSON.stringify(data) })) });
  return users.length;
}

/** Benachrichtigung an bestimmte Benutzer */
export async function notifyUsers(userIds: string[], type: string, data: Record<string, string>) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return 0;
  await prisma.notification.createMany({ data: unique.map((userId) => ({ userId, type, data: JSON.stringify(data) })) });
  return unique.length;
}

/** Gelesene Benachrichtigungen nach 30 Tagen, ungelesene nach 180 Tagen entfernen */
export async function purgeNotifications(now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const { count } = await prisma.notification.deleteMany({
    where: { OR: [{ readAt: { lt: new Date(now.getTime() - 30 * day) } }, { createdAt: { lt: new Date(now.getTime() - 180 * day) } }] },
  });
  if (count > 0) logger.info(`${count} alte Benachrichtigungen entfernt.`);
  return count;
}
