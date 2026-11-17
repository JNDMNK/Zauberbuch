import { Router } from 'express';
import {
  USER_EXPORT_FORMAT,
  createUserSchema,
  updateUserSchema,
  userImportEntrySchema,
  userImportSchema,
  type Locale,
  type Role,
  type UserExportFile,
  type UserImportEntry,
  type UserImportPreview,
  type UserImportPreviewItem,
  type UserImportResult,
} from '@zauberbuch/shared';
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

// ---------------------------------------------------------------- Export / Import

usersRouter.get('/export', async (req, res) => {
  const withPasswords = req.query.passwords !== 'false';
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { favorites: { select: { spell: { select: { slug: true } } } } },
  });
  const body: UserExportFile = {
    format: USER_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    includesPasswords: withPasswords,
    users: users.map((u) => ({
      username: u.username,
      email: u.email,
      role: u.role as Role,
      language: u.language as Locale,
      ...(withPasswords ? { passwordHash: u.passwordHash } : {}),
      favorites: u.favorites.map((f) => f.spell.slug).sort(),
      createdAt: u.createdAt.toISOString(),
    })),
  };
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="zauberbuch-benutzer-${date}.json"`);
  res.json(body);
});

interface AnalyzedUser {
  item: UserImportPreviewItem;
  entry?: UserImportEntry;
  existingId?: string;
}

async function analyzeUserImport(raw: unknown[], mode: 'skip' | 'update', hasDefaultPassword: boolean, selfId: string) {
  const users = await prisma.user.findMany({ select: { id: true, username: true, email: true } });
  const byName = new Map(users.map((u) => [u.username.toLowerCase(), u]));
  const byEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u]));
  const seen = new Set<string>();

  return raw.map<AnalyzedUser>((r, index) => {
    const parsed = userImportEntrySchema.safeParse(r);
    const rawName = r && typeof r === 'object' && typeof (r as { username?: unknown }).username === 'string' ? (r as { username: string }).username : null;
    if (!parsed.success) {
      return {
        item: { index, username: rawName, role: null, favorites: 0, status: 'invalid', errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) },
      };
    }
    const e = parsed.data;
    const base = { index, username: e.username, role: e.role, favorites: e.favorites.length };
    const key = e.username.toLowerCase();
    if (seen.has(key)) return { item: { ...base, status: 'invalid', errors: ['username: duplicate_in_file'] } };
    seen.add(key);
    const existing = byName.get(key);
    const emailOwner = e.email ? byEmail.get(e.email) : undefined;
    if (existing) {
      if (existing.id === selfId) return { item: { ...base, status: 'self' } };
      if (mode === 'skip') return { item: { ...base, status: 'exists' } };
      if (emailOwner && emailOwner.id !== existing.id) return { item: { ...base, status: 'conflict', errors: ['email: email_taken'] } };
      return { item: { ...base, status: 'update' }, entry: e, existingId: existing.id };
    }
    if (emailOwner) return { item: { ...base, status: 'conflict', errors: ['email: email_taken'] } };
    if (!e.passwordHash && !hasDefaultPassword) return { item: { ...base, status: 'no_password' } };
    return { item: { ...base, status: 'new' }, entry: e };
  });
}

usersRouter.post('/import/preview', async (req, res) => {
  const { users, mode, defaultPassword } = validate(userImportSchema, req.body);
  const analyzed = await analyzeUserImport(users, mode, Boolean(defaultPassword), req.user!.id);
  const items = analyzed.map((a) => a.item);
  const count = (s: UserImportPreviewItem['status']) => items.filter((i) => i.status === s).length;
  const body: UserImportPreview = {
    items,
    summary: {
      total: items.length,
      new: count('new'),
      exists: count('exists'),
      update: count('update'),
      self: count('self'),
      no_password: count('no_password'),
      conflict: count('conflict'),
      invalid: count('invalid'),
    },
  };
  res.json(body);
});

usersRouter.post('/import', async (req, res) => {
  const { users, mode, defaultPassword } = validate(userImportSchema, req.body);
  const analyzed = await analyzeUserImport(users, mode, Boolean(defaultPassword), req.user!.id);
  const result: UserImportResult = { created: 0, updated: 0, skipped: 0, invalid: 0, favoritesLinked: 0, favoritesMissing: 0 };
  const defaultHash = defaultPassword ? await hashPassword(defaultPassword) : null;
  const spells = await prisma.spell.findMany({ select: { id: true, slug: true } });
  const spellIdBySlug = new Map(spells.map((s) => [s.slug, s.id]));

  await prisma.$transaction(
    async (tx) => {
      for (const a of analyzed) {
        if (a.item.status === 'invalid') {
          result.invalid++;
          continue;
        }
        if (!a.entry) {
          result.skipped++;
          continue;
        }
        const e = a.entry;
        let userId: string;
        if (a.item.status === 'new') {
          const created = await tx.user.create({
            data: {
              username: e.username,
              email: e.email,
              role: e.role,
              language: e.language ?? config.defaultLanguage,
              passwordHash: e.passwordHash ?? defaultHash!,
            },
          });
          userId = created.id;
          result.created++;
        } else {
          userId = a.existingId!;
          await tx.user.update({
            where: { id: userId },
            data: {
              email: e.email,
              role: e.role,
              ...(e.language ? { language: e.language } : {}),
              // Neues Passwort meldet bestehende Sitzungen ab
              ...(e.passwordHash ? { passwordHash: e.passwordHash, tokenVersion: { increment: 1 } } : {}),
            },
          });
          result.updated++;
        }
        // „Mein Zauberbuch“: fehlende Einträge ergänzen (vorhandene bleiben)
        const ids = [...new Set(e.favorites)].map((slug) => spellIdBySlug.get(slug));
        result.favoritesMissing += ids.filter((id) => !id).length;
        const wanted = ids.filter((id): id is string => Boolean(id));
        if (wanted.length) {
          const have = new Set((await tx.favorite.findMany({ where: { userId }, select: { spellId: true } })).map((f) => f.spellId));
          const add = wanted.filter((id) => !have.has(id));
          if (add.length) await tx.favorite.createMany({ data: add.map((spellId) => ({ userId, spellId })) });
          result.favoritesLinked += add.length;
        }
      }
    },
    { timeout: 120_000 },
  );
  res.json(result);
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
