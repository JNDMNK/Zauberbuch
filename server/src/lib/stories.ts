import type { Prisma, User } from '@prisma/client';
import { isEditorRole, type StoryRole } from '@zauberbuch/shared';
import { prisma } from './prisma';

/**
 * Rechte pro Geschichte (Infotafel, Kampf, Spieler-Monster-Datenbank, Bögen der Geschichte):
 * - Maßgeblich ist die Rolle in der Geschichte (player | dm).
 * - Der Admin hat überall DM-Rechte – außer er ist in der Geschichte als Spieler eingetragen.
 * - Moderatoren (Server-Rolle) verwalten Geschichten in der Verwaltung, sehen Infotafel/Kampf aber nur gemäß ihrer Rolle.
 */
export type ViewUser = Pick<User, 'id' | 'role'>;

export const isAdmin = (u: ViewUser) => u.role === 'admin';
/** Admin und Moderator: Geschichten in der Verwaltung pflegen */
export const canManageStories = (u: ViewUser) => isEditorRole(u.role);

export function roleFromMembership(u: ViewUser, membershipRole: string | null | undefined): StoryRole | null {
  if (isAdmin(u)) return membershipRole === 'player' ? 'player' : 'dm';
  return membershipRole === 'dm' ? 'dm' : membershipRole === 'player' ? 'player' : null;
}

export async function storyRole(u: ViewUser, storyId: string): Promise<StoryRole | null> {
  const m = await prisma.storyMember.findUnique({ where: { storyId_userId: { storyId, userId: u.id } }, select: { role: true } });
  return roleFromMembership(u, m?.role);
}

/** Geschichten, die der Benutzer in Infotafel/Kampf sieht */
export function visibleStoryWhere(u: ViewUser): Prisma.StoryWhereInput {
  return isAdmin(u) ? {} : { members: { some: { userId: u.id } } };
}

/** IDs der Geschichten, in denen der Benutzer DM-Rechte hat */
export async function dmStoryIds(u: ViewUser): Promise<string[]> {
  if (isAdmin(u)) {
    const [all, playing] = await Promise.all([
      prisma.story.findMany({ select: { id: true } }),
      prisma.storyMember.findMany({ where: { userId: u.id, role: 'player' }, select: { storyId: true } }),
    ]);
    const asPlayer = new Set(playing.map((p) => p.storyId));
    return all.map((s) => s.id).filter((id) => !asPlayer.has(id));
  }
  const rows = await prisma.storyMember.findMany({ where: { userId: u.id, role: 'dm' }, select: { storyId: true } });
  return rows.map((r) => r.storyId);
}

/** Hat der Benutzer in irgendeiner Geschichte DM-Rechte? (z. B. für die DM-Monster-Datenbank) */
export async function isDmAnywhere(u: ViewUser): Promise<boolean> {
  if (isAdmin(u)) return true;
  return (await prisma.storyMember.count({ where: { userId: u.id, role: 'dm' } })) > 0;
}
