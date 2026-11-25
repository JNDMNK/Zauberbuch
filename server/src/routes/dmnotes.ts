import { Router, type Request } from 'express';
import type { DmNote, DmNoteVersion } from '@prisma/client';
import {
  DM_NOTE_STATUSES,
  MAX_DM_NOTE_BODY,
  dmNoteImageSchema,
  dmNoteMonsterSchema,
  dmNoteOrderSchema,
  dmNoteSchema,
  dmNoteShareSchema,
  stripDmSecrets,
  type BoardCategory,
  type DmNoteDto,
  type DmNoteKind,
  type DmNoteMonster,
  type DmNoteStatus,
  type DmNoteVersionDto,
} from '@zauberbuch/shared';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { storyRole } from '../lib/stories';
import { publishToStory, publishToUsers } from '../lib/events';
import { notifyUsers } from '../lib/notifications';

/**
 * DM-Notizen je Geschichte: lesen und schreiben nur die Dungeon Master der Geschichte
 * (Admin wie überall, sofern er dort nicht als Spieler eingetragen ist).
 */
export const dmNotesRouter = Router();
dmNotesRouter.use(requireAuth);

/** Versionen: höchstens so viele je Abschnitt; Änderungen derselben Person kurz hintereinander bilden eine Version */
const MAX_VERSIONS = 30;
const VERSION_GAP_MS = 10 * 60 * 1000;

function jsonList<T>(raw: string, schema?: z.ZodType<T>): T[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return schema ? v.flatMap((x) => (schema.safeParse(x).success ? [x as T] : [])) : (v as T[]);
  } catch {
    return [];
  }
}

const toDto = (n: DmNote): DmNoteDto => ({
  id: n.id,
  title: n.title,
  body: n.body,
  position: n.position,
  updatedAt: n.updatedAt.toISOString(),
  updatedBy: n.updatedBy,
  parentId: n.parentId,
  kind: n.kind as DmNoteKind,
  status: n.status as DmNoteStatus,
  tags: jsonList<string>(n.tags).filter((t) => typeof t === 'string'),
  pinned: n.pinned,
  gameDate: n.gameDate,
  sessionDate: n.sessionDate,
  xp: n.xp,
  tableRows: jsonList<string>(n.tableRows).filter((t) => typeof t === 'string'),
  monsters: jsonList<DmNoteMonster>(n.monsters, dmNoteMonsterSchema),
  characterIds: jsonList<string>(n.characterIds).filter((t) => typeof t === 'string'),
  sharedAt: n.sharedAt?.toISOString() ?? null,
  sharedInfo: n.sharedInfo,
});

const versionDto = (v: DmNoteVersion): DmNoteVersionDto => ({ id: v.id, title: v.title, body: v.body, updatedBy: v.updatedBy, createdAt: v.createdAt.toISOString() });

async function requireDm(req: Request, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, archived: true } });
  if (!story) throw notFound();
  if ((await storyRole(req.user!, storyId)) !== 'dm') throw forbidden();
  return story;
}

async function loadNote(req: Request) {
  const note = await prisma.dmNote.findUnique({ where: { id: String(req.params.id) } });
  if (!note) throw notFound();
  await requireDm(req, note.storyId);
  return note;
}

const ordered = (storyId: string) => prisma.dmNote.findMany({ where: { storyId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });

/** Übergeordneter Abschnitt: muss zur Geschichte gehören und darf kein eigener Nachfahre sein (kein Kreis) */
async function checkParent(storyId: string, parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return null;
  const all = await prisma.dmNote.findMany({ where: { storyId }, select: { id: true, parentId: true } });
  const byId = new Map(all.map((n) => [n.id, n.parentId]));
  if (!byId.has(parentId)) throw badRequest('dm_note_parent_invalid', 'Parent not found');
  for (let cur: string | null | undefined = parentId, i = 0; cur && i < 100; cur = byId.get(cur), i++) {
    if (cur === selfId) throw badRequest('dm_note_parent_invalid', 'Parent would create a cycle');
  }
  return parentId;
}

/** Nur Charaktere dieser Geschichte verknüpfen */
async function checkCharacters(storyId: string, ids: string[] | undefined) {
  if (!ids) return undefined;
  const found = await prisma.character.findMany({ where: { id: { in: ids }, storyId }, select: { id: true } });
  const ok = new Set(found.map((c) => c.id));
  return ids.filter((id) => ok.has(id));
}

/** Gemeinsame Felder aus der Eingabe (nur gesetzte Felder) */
function fields(input: z.infer<typeof dmNoteSchema>) {
  return {
    title: input.title,
    body: input.body,
    ...(input.kind !== undefined && { kind: input.kind }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.tags !== undefined && { tags: JSON.stringify([...new Set(input.tags)]) }),
    ...(input.pinned !== undefined && { pinned: input.pinned }),
    ...(input.gameDate !== undefined && { gameDate: input.gameDate }),
    ...(input.sessionDate !== undefined && { sessionDate: input.sessionDate }),
    ...(input.xp !== undefined && { xp: input.xp }),
    ...(input.tableRows !== undefined && { tableRows: JSON.stringify(input.tableRows) }),
    ...(input.monsters !== undefined && { monsters: JSON.stringify(input.monsters) }),
  };
}

dmNotesRouter.get('/stories/:storyId', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  res.json({ notes: (await ordered(storyId)).map(toDto) });
});

/** Neuer Abschnitt – kommt ans Ende seiner Ebene */
dmNotesRouter.post('/stories/:storyId', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const input = validate(dmNoteSchema, req.body);
  const parentId = await checkParent(storyId, input.parentId);
  const characterIds = await checkCharacters(storyId, input.characterIds);
  const last = await prisma.dmNote.aggregate({ where: { storyId }, _max: { position: true } });
  const note = await prisma.dmNote.create({
    data: { storyId, ...fields(input), parentId, ...(characterIds && { characterIds: JSON.stringify(characterIds) }), position: (last._max.position ?? -1) + 1, updatedBy: req.user!.username },
  });
  res.status(201).json({ note: toDto(note) });
});

/** Reihenfolge setzen: ids in der gewünschten Reihenfolge (fremde ids werden ignoriert); optional neu einordnen */
dmNotesRouter.put('/stories/:storyId/order', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const { ids, parentId } = validate(dmNoteOrderSchema, req.body);
  const own = new Set((await prisma.dmNote.findMany({ where: { storyId }, select: { id: true } })).map((n) => n.id));
  const list = ids.filter((id) => own.has(id));
  if (parentId !== undefined) for (const id of list) await checkParent(storyId, parentId, id);
  // Positionen global eindeutig halten: die Geschwister bekommen die Plätze, die sie vorher belegt haben
  const current = await prisma.dmNote.findMany({ where: { id: { in: list } }, select: { position: true }, orderBy: { position: 'asc' } });
  const slots = current.map((c) => c.position);
  await prisma.$transaction(list.map((id, i) => prisma.dmNote.update({ where: { id }, data: { position: slots[i] ?? i, ...(parentId !== undefined && { parentId }) } })));
  res.json({ notes: (await ordered(storyId)).map(toDto) });
});

dmNotesRouter.put('/:id', async (req, res) => {
  const note = await loadNote(req);
  const input = validate(dmNoteSchema, req.body);
  const parentId = input.parentId === undefined ? note.parentId : await checkParent(note.storyId, input.parentId, note.id);
  const characterIds = await checkCharacters(note.storyId, input.characterIds);
  // Alte Fassung sichern, wenn sich Titel oder Text ändern (Änderungen derselben Person in kurzer Folge zusammenfassen)
  if (input.title !== note.title || input.body !== note.body) {
    const lastVersion = await prisma.dmNoteVersion.findFirst({ where: { noteId: note.id }, orderBy: { createdAt: 'desc' } });
    const recentSameUser = note.updatedBy === req.user!.username && Date.now() - note.updatedAt.getTime() < VERSION_GAP_MS && lastVersion && Date.now() - lastVersion.createdAt.getTime() < VERSION_GAP_MS;
    if (!recentSameUser) {
      await prisma.dmNoteVersion.create({ data: { noteId: note.id, title: note.title, body: note.body, updatedBy: note.updatedBy } });
      const old = await prisma.dmNoteVersion.findMany({ where: { noteId: note.id }, orderBy: { createdAt: 'desc' }, skip: MAX_VERSIONS, select: { id: true } });
      if (old.length) await prisma.dmNoteVersion.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  }
  const updated = await prisma.dmNote.update({
    where: { id: note.id },
    data: { ...fields(input), parentId, ...(characterIds && { characterIds: JSON.stringify(characterIds) }), updatedBy: req.user!.username },
  });
  res.json({ note: toDto(updated) });
});

/** Nur Status/Anpinnen/Text ändern (z. B. Checkliste abhaken) – ohne den ganzen Abschnitt zu senden */
const patchSchema = z.object({ status: z.enum(DM_NOTE_STATUSES).optional(), pinned: z.boolean().optional(), body: z.string().max(MAX_DM_NOTE_BODY).optional() });
dmNotesRouter.patch('/:id', async (req, res) => {
  const note = await loadNote(req);
  const input = validate(patchSchema, req.body);
  const updated = await prisma.dmNote.update({
    where: { id: note.id },
    data: { ...(input.status !== undefined && { status: input.status }), ...(input.pinned !== undefined && { pinned: input.pinned }), ...(input.body !== undefined && { body: input.body }), updatedBy: req.user!.username },
  });
  res.json({ note: toDto(updated) });
});

/** Löschen: Unterabschnitte rücken eine Ebene nach oben */
dmNotesRouter.delete('/:id', async (req, res) => {
  const note = await loadNote(req);
  await prisma.$transaction([prisma.dmNote.updateMany({ where: { parentId: note.id }, data: { parentId: note.parentId } }), prisma.dmNote.delete({ where: { id: note.id } })]);
  res.status(204).end();
});

// ---------------------------------------------------------------- Versionen

dmNotesRouter.get('/:id/versions', async (req, res) => {
  const note = await loadNote(req);
  const versions = await prisma.dmNoteVersion.findMany({ where: { noteId: note.id }, orderBy: { createdAt: 'desc' } });
  res.json({ versions: versions.map(versionDto) });
});

/** Ältere Fassung wiederherstellen (die aktuelle wird dabei selbst als Version gesichert) */
dmNotesRouter.post('/:id/versions/:versionId/restore', async (req, res) => {
  const note = await loadNote(req);
  const v = await prisma.dmNoteVersion.findFirst({ where: { id: String(req.params.versionId), noteId: note.id } });
  if (!v) throw notFound();
  await prisma.dmNoteVersion.create({ data: { noteId: note.id, title: note.title, body: note.body, updatedBy: note.updatedBy } });
  const updated = await prisma.dmNote.update({ where: { id: note.id }, data: { title: v.title, body: v.body, updatedBy: req.user!.username } });
  res.json({ note: toDto(updated) });
});

// ---------------------------------------------------------------- Bilder

dmNotesRouter.post('/stories/:storyId/images', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const { image } = validate(dmNoteImageSchema, req.body);
  const img = await prisma.dmNoteImage.create({ data: { storyId, data: image } });
  res.status(201).json({ url: `/api/dm-notes/images/${img.id}` });
});

/** Bild abrufen: DMs der Geschichte; nach einer Freigabe auch alle Mitglieder */
dmNotesRouter.get('/images/:imageId', async (req, res) => {
  const img = await prisma.dmNoteImage.findUnique({ where: { id: String(req.params.imageId) } });
  if (!img) throw notFound();
  const role = await storyRole(req.user!, img.storyId);
  if (!role || (role !== 'dm' && !img.public)) throw notFound();
  const m = img.data.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) throw notFound();
  res.setHeader('Content-Type', m[1]);
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(Buffer.from(m[2], 'base64'));
});

// ---------------------------------------------------------------- Freigeben

const BOARD_CATEGORY: Partial<Record<DmNoteKind, BoardCategory>> = { place: 'places', npc: 'npcs', faction: 'npcs', item: 'items', lore: 'lore', session: 'dates' };

/** Abschnitt (ohne geheime Stellen) als Infotafel-Beitrag oder Direktnachricht an Spieler freigeben */
dmNotesRouter.post('/:id/share', async (req, res) => {
  const note = await loadNote(req);
  const story = await prisma.story.findUniqueOrThrow({ where: { id: note.storyId }, include: { members: true } });
  if (story.archived) throw forbidden('story_archived', 'Story is archived');
  const input = validate(dmNoteShareSchema, req.body);
  const body = stripDmSecrets(note.body);
  // Bilder im freigegebenen Text für Mitglieder sichtbar machen
  const imageIds = [...body.matchAll(/\/api\/dm-notes\/images\/([a-z0-9]+)/g)].map((m) => m[1]);
  if (imageIds.length) await prisma.dmNoteImage.updateMany({ where: { id: { in: imageIds }, storyId: story.id }, data: { public: true } });
  let info: string;
  if (input.to === 'board') {
    const text = body || note.title;
    await prisma.boardPost.create({
      data: { storyId: story.id, authorId: req.user!.id, title: note.title, body: text, category: BOARD_CATEGORY[note.kind as DmNoteKind] ?? 'general', searchText: `${note.title}\n${text}`.toLocaleLowerCase('de') },
    });
    const others = story.members.map((m) => m.userId).filter((id) => id !== req.user!.id);
    await notifyUsers(others, 'board_post', { author: req.user!.username, story: story.name, title: note.title, link: `/board/${story.id}` });
    publishToStory(story.id, { type: 'board', storyId: story.id });
    info = 'board';
  } else {
    const members = new Set(story.members.map((m) => m.userId));
    const targets = [...new Set(input.userIds)].filter((id) => members.has(id) && id !== req.user!.id);
    if (targets.length === 0) throw badRequest('dm_note_share_empty', 'No valid recipients');
    const text = `**${note.title}**\n\n${body}`.trim();
    const message = text.length > 4000 ? `${text.slice(0, 3990)} …` : text;
    await prisma.chatMessage.createMany({ data: targets.map((recipientId) => ({ storyId: story.id, senderId: req.user!.id, recipientId, body: message })) });
    publishToUsers([req.user!.id, ...targets], { type: 'chat', storyId: story.id });
    const names = await prisma.user.findMany({ where: { id: { in: targets } }, select: { username: true } });
    info = `chat:${names.map((n) => n.username).join(', ')}`;
  }
  const updated = await prisma.dmNote.update({ where: { id: note.id }, data: { sharedAt: new Date(), sharedInfo: info } });
  res.json({ note: toDto(updated) });
});

// ---------------------------------------------------------------- Kampf vorbereiten

/** Begegnung → neuer Kampf in der Geschichte mit den hinterlegten Monstern aus der DM-Datenbank */
dmNotesRouter.post('/:id/encounter', async (req, res) => {
  const note = await loadNote(req);
  const monsters = jsonList<DmNoteMonster>(note.monsters, dmNoteMonsterSchema);
  const templates = await prisma.monsterTemplate.findMany({ where: { id: { in: monsters.map((m) => m.templateId) } } });
  const byId = new Map(templates.map((t) => [t.id, t]));
  const enc = await prisma.encounter.create({ data: { storyId: note.storyId, name: note.title.slice(0, 80) } });
  const rows = monsters.flatMap((m) => {
    const t = byId.get(m.templateId);
    if (!t) return [];
    return Array.from({ length: m.count }, (_, i) => ({
      encounterId: enc.id,
      kind: 'monster',
      name: m.count > 1 ? `${t.name} ${i + 1}` : t.name,
      ac: t.ac,
      hpMax: t.hp,
      hpCurrent: t.hp,
      hideStats: true,
      attack: t.attack,
      description: t.description,
      damageDice: t.damageDice,
      damageType: t.damageType,
      templateId: t.id,
    }));
  });
  if (rows.length) await prisma.combatant.createMany({ data: rows.slice(0, 50) });
  publishToStory(note.storyId, { type: 'combat', storyId: note.storyId });
  res.status(201).json({ encounterId: enc.id });
});
