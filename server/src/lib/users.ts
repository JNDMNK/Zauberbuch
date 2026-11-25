import type { User } from '@prisma/client';
import { avatarUrlFor, type Locale, type Role, type UserDto } from '@zauberbuch/shared';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as Role,
    canEditSpells: user.canEditSpells,
    combatAsPlayer: user.combatAsPlayer,
    activeStoryId: user.activeStoryId ?? null,
    language: user.language as Locale,
    createdAt: user.createdAt.toISOString(),
    avatarUrl: avatarUrlFor(user.id, user.avatarUpdatedAt),
  };
}
