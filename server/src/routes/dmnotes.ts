import { Router, type Request } from 'express';
import type { DmNote } from '@prisma/client';
import { dmNoteOrderSchema, dmNoteSchema, type DmNoteDto } from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { forbidden, notFound } from '../lib/errors';
import { requireAuth } from '../middleware/auth';
import { storyRole } from '../lib/stories';

/**
 * DM-Notizen je Geschichte: lesen und schreiben nur die Dungeon Master der Geschichte
 * (Admin wie überall, sofern er dort nicht als Spieler eingetragen ist).
 */
export const dmNotesRouter = Router();
dmNotesRouter.use(requireAuth);

const toDto = (n: DmNote): DmNoteDto => ({ id: n.id, title: n.title, body: n.body, position: n.position, updatedAt: n.updatedAt.toISOString(), updatedBy: n.updatedBy });

async function requireDm(req: Request, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true } });
  if (!story) throw notFound();
  if ((await storyRole(req.user!, storyId)) !== 'dm') throw forbidden();
}

async function loadNote(req: Request) {
  const note = await prisma.dmNote.findUnique({ where: { id: String(req.params.id) } });
  if (!note) throw notFound();
  await requireDm(req, note.storyId);
  return note;
}

dmNotesRouter.get('/stories/:storyId', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const notes = await prisma.dmNote.findMany({ where: { storyId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  res.json({ notes: notes.map(toDto) });
});

/** Neuer Abschnitt – kommt ans Ende */
dmNotesRouter.post('/stories/:storyId', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const input = validate(dmNoteSchema, req.body);
  const last = await prisma.dmNote.aggregate({ where: { storyId }, _max: { position: true } });
  const note = await prisma.dmNote.create({ data: { storyId, title: input.title, body: input.body, position: (last._max.position ?? -1) + 1, updatedBy: req.user!.username } });
  res.status(201).json({ note: toDto(note) });
});

/** Reihenfolge setzen: ids in der gewünschten Reihenfolge (fremde ids werden ignoriert) */
dmNotesRouter.put('/stories/:storyId/order', async (req, res) => {
  const storyId = String(req.params.storyId);
  await requireDm(req, storyId);
  const { ids } = validate(dmNoteOrderSchema, req.body);
  const own = new Set((await prisma.dmNote.findMany({ where: { storyId }, select: { id: true } })).map((n) => n.id));
  const ordered = ids.filter((id) => own.has(id));
  await prisma.$transaction(ordered.map((id, position) => prisma.dmNote.update({ where: { id }, data: { position } })));
  const notes = await prisma.dmNote.findMany({ where: { storyId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  res.json({ notes: notes.map(toDto) });
});

dmNotesRouter.put('/:id', async (req, res) => {
  const note = await loadNote(req);
  const input = validate(dmNoteSchema, req.body);
  const updated = await prisma.dmNote.update({ where: { id: note.id }, data: { title: input.title, body: input.body, updatedBy: req.user!.username } });
  res.json({ note: toDto(updated) });
});

dmNotesRouter.delete('/:id', async (req, res) => {
  const note = await loadNote(req);
  await prisma.dmNote.delete({ where: { id: note.id } });
  res.status(204).end();
});
