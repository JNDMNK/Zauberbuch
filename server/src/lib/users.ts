import type { User } from '@prisma/client';
import type { Locale, Role, UserDto } from '@zauberbuch/shared';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role as Role,
    language: user.language as Locale,
    createdAt: user.createdAt.toISOString(),
  };
}
