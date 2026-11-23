import { z } from 'zod';
import { CASTING_TIMES, CLASSES, DAMAGE_TYPES, LOCALES, ROLES, SCHOOLS, SORT_FIELDS } from './enums';

const trimmed = (max: number) => z.string().trim().max(max);

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'slug_required')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug_invalid');

/**
 * Würfelausdruck für Schaden/Heilung, z. B. "8d6", "1d4+1", "2d8 + 1d6", "1d4+mod".
 * Erlaubt sind Würfel (NdM, auch "W" statt "d"), ganze Zahlen und "mod" (Zauberattributsmodifikator),
 * verbunden mit + oder -. Wird normalisiert gespeichert: Kleinbuchstaben, "d", ohne Leerzeichen.
 */
const DICE_TERM = String.raw`(?:\d{0,3}d\d{1,3}|\d{1,4}|mod)`;
const DICE_RE = new RegExp(`^${DICE_TERM}(?:[+-]${DICE_TERM}){0,7}$`);

export function normalizeDice(input: string): string {
  return input.trim().toLowerCase().replace(/w/g, 'd').replace(/\s+/g, '');
}

export const damageDiceSchema = z
  .string()
  .max(60)
  .transform(normalizeDice)
  .refine((v) => v === '' || DICE_RE.test(v), 'damage_dice_invalid')
  .transform((v) => (v === '' ? null : v));

export const spellTranslationSchema = z.object({
  name: trimmed(200).min(1, 'name_required'),
  materialDescription: trimmed(1000).optional().nullable(),
  castingTimeText: trimmed(200).optional().nullable(),
  rangeText: trimmed(200).optional().nullable(),
  durationText: trimmed(200).optional().nullable(),
  description: z.string().trim().min(1, 'description_required').max(20000),
  higherLevels: z.string().trim().max(10000).optional().nullable(),
});
export type SpellTranslationInput = z.infer<typeof spellTranslationSchema>;

export const spellInputSchema = z
  .object({
    slug: slugSchema,
    level: z.number().int().min(0).max(9),
    school: z.enum(SCHOOLS),
    castingTime: z.enum(CASTING_TIMES),
    range: trimmed(100).min(1, 'range_required'),
    components: z.object({
      verbal: z.boolean(),
      somatic: z.boolean(),
      material: z.boolean(),
    }),
    concentration: z.boolean(),
    ritual: z.boolean(),
    duration: trimmed(100).min(1, 'duration_required'),
    classes: z.array(z.enum(CLASSES)).max(CLASSES.length),
    /** Eigene Wiki-Klassen (IDs), denen der Zauber zusätzlich zugeordnet ist */
    wikiClasses: z.array(z.string().min(1).max(64)).max(50).optional(),
    source: trimmed(100).min(1, 'source_required'),
    isHomebrew: z.boolean(),
    /** Schaden/Heilung (optional): Würfelausdruck + Art – beide oder keins */
    damageDice: damageDiceSchema.optional().nullable(),
    damageType: z.enum(DAMAGE_TYPES).optional().nullable(),
    translations: z
      .object({
        de: spellTranslationSchema.optional().nullable(),
        en: spellTranslationSchema.optional().nullable(),
      })
      .refine((t) => Boolean(t.de || t.en), { message: 'translation_required' }),
  })
  .superRefine((spell, ctx) => {
    if (spell.damageDice && !spell.damageType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageType'], message: 'damage_type_required' });
    }
    if (spell.damageType && !spell.damageDice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['damageDice'], message: 'damage_dice_required' });
    }
    if (spell.components.material) {
      const hasMaterial = LOCALES.some((l) => spell.translations[l]?.materialDescription?.trim());
      if (!hasMaterial) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['translations'],
          message: 'material_required',
        });
      }
    }
  });
export type SpellInput = z.infer<typeof spellInputSchema>;

export const spellImportSchema = z.object({
  mode: z.enum(['skip', 'overwrite']).default('skip'),
  spells: z.array(z.unknown()).min(1).max(5000),
});

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return [] as T[number][];
      const arr = (Array.isArray(v) ? v : v.split(',')).map((s) => s.trim()).filter(Boolean);
      return arr.filter((s): s is T[number] => (values as readonly string[]).includes(s));
    });

const boolParam = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true' || v === '1'));

export const spellQuerySchema = z.object({
  query: z.string().trim().max(200).optional().default(''),
  /** true: Suchbegriff nur im Zaubernamen (DE und EN) suchen, nicht in der Beschreibung */
  nameOnly: boolParam,
  level: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return [] as number[];
      const arr = Array.isArray(v) ? v : v.split(',');
      return arr
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 9);
    }),
  school: csv(SCHOOLS),
  class: csv(CLASSES),
  castingTime: csv(CASTING_TIMES),
  damageType: csv(DAMAGE_TYPES),
  concentration: boolParam,
  ritual: boolParam,
  verbal: boolParam,
  somatic: boolParam,
  material: boolParam,
  homebrew: boolParam,
  source: z.string().trim().max(100).optional(),
  /** Zauber einer eigenen Wiki-Klasse (ID); zusammen mit class = Zauber der Listen ODER der Klasse */
  wikiClass: z.string().trim().min(1).max(64).optional(),
  /** Nur Zauber aus den Quellen dieser Geschichte (Geschichten-Ansicht) */
  story: z.string().trim().min(1).max(64).optional(),
  favorites: boolParam,
  /** Zauberbuch (Favoriten) eines bestimmten Benutzers – nur für Admin/Dungeon Master */
  owner: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(SORT_FIELDS).optional().default('name'),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  lang: z.enum(LOCALES).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
});
export type SpellQuery = z.infer<typeof spellQuerySchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'username_too_short')
  .max(32, 'username_too_long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'username_invalid');

export const passwordSchema = z.string().min(8, 'password_too_short').max(200, 'password_too_long');

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'email_invalid')
  .transform((v) => (v === '' ? null : v))
  .optional()
  .nullable();

/** Benutzer anlegen (nur Admin – keine Selbstregistrierung) */
export const createUserSchema = z.object({
  username: usernameSchema,
  email: optionalEmail,
  password: passwordSchema,
  role: z.enum(ROLES).default('user'),
  canEditSpells: z.boolean().optional().default(false),
  language: z.enum(LOCALES).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
  /** Benutzername oder E-Mail */
  identifier: z.string().trim().min(1, 'identifier_required').max(200),
  password: z.string().min(1, 'password_required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateMeSchema = z.object({
  language: z.enum(LOCALES),
});

/** Benutzer ändern (nur Admin): Rolle und/oder neues Passwort */
export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    password: passwordSchema.optional(),
    canEditSpells: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.password !== undefined || v.canEditSpells !== undefined, { message: 'nothing_to_update' });

export const favoriteSchema = z.object({
  spellId: z.string().min(1).max(100),
});

// ---------------------------------------------------------------- Benutzer-Export/-Import (nur Admin)

export const USER_EXPORT_FORMAT = 'zauberbuch-users';

/** bcrypt-Hash ($2a$/$2b$/$2y$) */
export const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export const userImportEntrySchema = z.object({
  username: usernameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'email_invalid')
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  role: z.enum(ROLES).optional().default('user'),
  canEditSpells: z.boolean().optional().default(false),
  language: z.enum(LOCALES).optional(),
  passwordHash: z.string().regex(BCRYPT_HASH_RE, 'password_hash_invalid').nullable().optional().transform((v) => v ?? null),
  /** Zauber in „Mein Zauberbuch“ (slugs) */
  favorites: z.array(z.string().max(120)).max(5000).optional().default([]),
});
export type UserImportEntry = z.infer<typeof userImportEntrySchema>;

export const userImportSchema = z.object({
  users: z.array(z.unknown()).min(1).max(5000),
  /** vorhandene Benutzer überspringen oder aktualisieren (E-Mail, Rolle, Sprache, Passwort, Zauberbuch) */
  mode: z.enum(['skip', 'update']).optional().default('skip'),
  /** Startpasswort für Einträge ohne Passwort-Hash; leer = solche Einträge überspringen */
  defaultPassword: passwordSchema.nullable().optional().default(null),
});
