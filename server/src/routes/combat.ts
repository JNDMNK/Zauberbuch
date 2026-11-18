import { Router, type Request } from 'express';
import type { Character, Combatant, Encounter, Prisma, Story, User } from '@prisma/client';
import {
  CONDITIONS,
  MAX_COMBATANTS,
  addCharactersSchema,
  addMonsterSchema,
  characterSheetSchema,
  combatantUpdateSchema,
  compareByInitiative,
  encounterInputSchema,
  encounterUpdateSchema,
  healthStatus,
  hpDeltaSchema,
  isEditorRole,
  turnSchema,
  type CharacterSheet,
  type CombatantDto,
  type Condition,
  type EncounterDto,
  type EncounterSummaryDto,
} from '@zauberbuch/shared';
import { prisma } from '../lib/prisma';
import { validate } from '../lib/validate';
import { badRequest, notFound } from '../lib/errors';
import { requireAuth, requireEditor } from '../middleware/auth';

/**
 * Kampfhilfe je Geschichte.
 * - Admin und Dungeon Master legen Kämpfe an und pflegen sie.
 * - Mitspieler der Geschichte sehen den Kampf nur lesend; bei verdeckten Monstern liefert der Server
 *   statt RK/LP nur einen groben Zustand.
 * - Werte der Spielercharaktere kommen live aus den Charakterbögen und werden hier nie geschrieben.
 */
export const combatRouter = Router();
combatRouter.use(requireAuth);

/**
 * Spielermodus für Admins (?asPlayer=true bei lesenden Anfragen): Der Admin sieht die Kampfhilfe wie ein Benutzer –
 * nur Kämpfe aus Geschichten, in denen er Mitspieler ist, verdeckte Monsterwerte entfernt, keine Verwaltung.
 */
const asPlayer = (req: Request) => req.user!.role === 'admin' && req.query.asPlayer === 'true';
const isEditor = (req: Request) => isEditorRole(req.user!.role) && !asPlayer(req);

type CombatantWithCharacter = Combatant & { character: (Character & { user: Pick<User, 'id' | 'username'> }) | null };
type EncounterFull = Encounter & { story: Pick<Story, 'name'>; combatants: CombatantWithCharacter[] };

const fullInclude = {
  story: { select: { name: true } },
  combatants: { include: { character: { include: { user: { select: { id: true, username: true } } } } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.EncounterInclude;

function parseSheet(raw: string): CharacterSheet {
  try {
    return characterSheetSchema.parse(JSON.parse(raw));
  } catch {
    return characterSheetSchema.parse({});
  }
}

function parseConditions(raw: string): Condition[] {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((c): c is Condition => (CONDITIONS as readonly string[]).includes(c)) : [];
  } catch {
    return [];
  }
}

function toCombatantDto(req: Request, c: CombatantWithCharacter): CombatantDto {
  const conditions = parseConditions(c.conditions);
  if (c.kind === 'character' && c.character) {
    const sheet = parseSheet(c.character.data);
    const own = c.character.userId === req.user!.id;
    return {
      id: c.id,
      kind: 'character',
      name: sheet.identity.name || c.character.name || '—',
      initiative: c.initiative,
      ac: sheet.combat.ac || null,
      hpCurrent: sheet.combat.hpCurrent,
      hpMax: sheet.combat.hpMax,
      hpTemp: sheet.combat.hpTemp || null,
      status: healthStatus(sheet.combat.hpCurrent, sheet.combat.hpMax),
      hideStats: false,
      conditions,
      owner: c.character.user.username,
      characterId: own || isEditor(req) ? c.character.id : null,
    };
  }
  const hidden = c.hideStats && !isEditor(req);
  return {
    id: c.id,
    kind: 'monster',
    name: c.name,
    initiative: c.initiative,
    ac: hidden || c.ac === null ? null : String(c.ac),
    hpCurrent: hidden ? null : c.hpCurrent,
    hpMax: hidden ? null : c.hpMax,
    hpTemp: null,
    status: healthStatus(c.hpCurrent, c.hpMax),
    hideStats: c.hideStats,
    conditions,
    owner: null,
    characterId: null,
  };
}

function toSummary(e: Encounter & { story: Pick<Story, 'name'>; _count?: { combatants: number }; combatants?: unknown[] }): EncounterSummaryDto {
  return {
    id: e.id,
    storyId: e.storyId,
    storyName: e.story.name,
    name: e.name,
    round: e.round,
    ended: e.ended,
    combatantCount: e._count?.combatants ?? e.combatants?.length ?? 0,
    updatedAt: e.updatedAt.toISOString(),
  };
}

function toEncounterDto(req: Request, e: EncounterFull): EncounterDto {
  return {
    ...toSummary(e),
    turnCombatantId: e.turnCombatantId,
    combatants: e.combatants.map((c) => toCombatantDto(req, c)),
    canManage: isEditor(req),
  };
}

/** Geschichten, deren Kämpfe der Benutzer sehen darf */
function storyFilter(req: Request): Prisma.StoryWhereInput {
  return isEditor(req) ? {} : { members: { some: { userId: req.user!.id } } };
}

async function loadEncounter(req: Request, id: string): Promise<EncounterFull> {
  const e = await prisma.encounter.findFirst({ where: { id, story: storyFilter(req) }, include: fullInclude });
  if (!e) throw notFound();
  return e;
}

async function sendEncounter(req: Request, res: import('express').Response, id: string) {
  res.json({ encounter: toEncounterDto(req, await loadEncounter(req, id)) });
}

const touch = (id: string) => prisma.encounter.update({ where: { id }, data: { updatedAt: new Date() } });

async function loadCombatant(req: Request, id: string) {
  const c = await prisma.combatant.findUnique({ where: { id } });
  if (!c) throw notFound();
  await loadEncounter(req, c.encounterId);
  return c;
}

// ---------------------------------------------------------------- Kämpfe

combatRouter.get('/encounters', async (req, res) => {
  const storyId = typeof req.query.storyId === 'string' && req.query.storyId ? req.query.storyId : undefined;
  const list = await prisma.encounter.findMany({
    where: { story: storyFilter(req), ...(storyId ? { storyId } : {}) },
    include: { story: { select: { name: true } }, _count: { select: { combatants: true } } },
    orderBy: [{ ended: 'asc' }, { updatedAt: 'desc' }],
  });
  res.json({ encounters: list.map(toSummary) });
});

/** Anzahl laufender Kämpfe (Markierung im Menü) */
combatRouter.get('/active', async (req, res) => {
  const count = await prisma.encounter.count({ where: { ended: false, story: storyFilter(req) } });
  res.json({ count });
});

combatRouter.post('/encounters', requireEditor, async (req, res) => {
  const input = validate(encounterInputSchema, req.body);
  const story = await prisma.story.findUnique({ where: { id: input.storyId } });
  if (!story) throw badRequest('story_not_found', 'Story not found');
  const e = await prisma.encounter.create({ data: { storyId: story.id, name: input.name } });
  res.status(201);
  await sendEncounter(req, res, e.id);
});

combatRouter.get('/encounters/:id', async (req, res) => {
  await sendEncounter(req, res, String(req.params.id));
});

combatRouter.patch('/encounters/:id', requireEditor, async (req, res) => {
  const e = await loadEncounter(req, String(req.params.id));
  const input = validate(encounterUpdateSchema, req.body);
  if (input.turnCombatantId && !e.combatants.some((c) => c.id === input.turnCombatantId)) throw badRequest('invalid_combatant', 'Unknown combatant');
  await prisma.encounter.update({ where: { id: e.id }, data: input });
  await sendEncounter(req, res, e.id);
});

combatRouter.delete('/encounters/:id', requireEditor, async (req, res) => {
  const e = await loadEncounter(req, String(req.params.id));
  await prisma.encounter.delete({ where: { id: e.id } });
  res.status(204).end();
});

/** Nächster/vorheriger Zug in Initiative-Reihenfolge; besiegte Monster werden übersprungen */
combatRouter.post('/encounters/:id/turn', requireEditor, async (req, res) => {
  const e = await loadEncounter(req, String(req.params.id));
  const { direction } = validate(turnSchema, req.body);
  const order = e.combatants
    .map((c) => ({ c, dto: toCombatantDto(req, c) }))
    .sort((a, b) => compareByInitiative(a.dto, b.dto));
  const eligible = order.filter(({ c, dto }) => !(c.kind === 'monster' && dto.status === 'down'));
  if (eligible.length === 0) throw badRequest('no_combatants', 'No active combatants');

  let round = e.round;
  const pos = order.findIndex(({ c }) => c.id === e.turnCombatantId);
  let next: string;
  if (pos === -1) {
    // Noch kein Zug (oder Teilnehmer entfernt): vorwärts beim Ersten beginnen, rückwärts beim Letzten
    next = (direction === 1 ? eligible[0] : eligible[eligible.length - 1]).c.id;
  } else {
    // Ausgehend von der Position in der Gesamtreihenfolge den nächsten aktiven Teilnehmer suchen;
    // beim Umlauf beginnt eine neue Runde (rückwärts: vorherige Runde)
    const n = order.length;
    let k = pos;
    for (let step = 0; step < n; step++) {
      k += direction;
      if (k >= n) {
        k = 0;
        round++;
      } else if (k < 0) {
        k = n - 1;
        round = Math.max(1, round - 1);
      }
      if (eligible.includes(order[k])) break;
    }
    next = order[k].c.id;
  }
  await prisma.encounter.update({ where: { id: e.id }, data: { turnCombatantId: next, round } });
  await sendEncounter(req, res, e.id);
});

// ---------------------------------------------------------------- Teilnehmer

combatRouter.post('/encounters/:id/characters', requireEditor, async (req, res) => {
  const e = await loadEncounter(req, String(req.params.id));
  const { characterIds } = validate(addCharactersSchema, req.body);
  const present = new Set(e.combatants.map((c) => c.characterId).filter(Boolean));
  const chars = await prisma.character.findMany({ where: { id: { in: [...new Set(characterIds)] } }, select: { id: true } });
  const toAdd = chars.filter((c) => !present.has(c.id));
  if (e.combatants.length + toAdd.length > MAX_COMBATANTS) throw badRequest('too_many_combatants', `At most ${MAX_COMBATANTS} combatants`);
  await prisma.combatant.createMany({ data: toAdd.map((c) => ({ encounterId: e.id, kind: 'character', characterId: c.id, hideStats: false })) });
  await touch(e.id);
  await sendEncounter(req, res, e.id);
});

combatRouter.post('/encounters/:id/monsters', requireEditor, async (req, res) => {
  const e = await loadEncounter(req, String(req.params.id));
  const input = validate(addMonsterSchema, req.body);
  if (e.combatants.length + input.count > MAX_COMBATANTS) throw badRequest('too_many_combatants', `At most ${MAX_COMBATANTS} combatants`);
  await prisma.combatant.createMany({
    data: Array.from({ length: input.count }, (_, i) => ({
      encounterId: e.id,
      kind: 'monster',
      name: input.count > 1 ? `${input.name} ${i + 1}` : input.name,
      ac: input.ac,
      hpMax: input.hpMax,
      hpCurrent: input.hpMax,
      initiative: input.initiative,
      hideStats: input.hideStats,
    })),
  });
  await touch(e.id);
  await sendEncounter(req, res, e.id);
});

combatRouter.patch('/combatants/:id', requireEditor, async (req, res) => {
  const c = await loadCombatant(req, String(req.params.id));
  const input = validate(combatantUpdateSchema, req.body);
  const data: Prisma.CombatantUpdateInput = {};
  if (input.initiative !== undefined) data.initiative = input.initiative;
  if (input.conditions !== undefined) data.conditions = JSON.stringify([...new Set(input.conditions)]);
  const monsterFields = ['name', 'ac', 'hpMax', 'hpCurrent', 'hideStats'] as const;
  if (c.kind === 'character') {
    // Werte aus dem Charakterbogen sind hier nur lesbar
    if (monsterFields.some((k) => input[k] !== undefined)) throw badRequest('character_read_only', 'Character values come from the character sheet');
  } else {
    if (input.name !== undefined) data.name = input.name;
    if (input.ac !== undefined) data.ac = input.ac;
    if (input.hideStats !== undefined) data.hideStats = input.hideStats;
    const hpMax = input.hpMax ?? c.hpMax;
    if (input.hpMax !== undefined) data.hpMax = hpMax;
    if (input.hpCurrent !== undefined || input.hpMax !== undefined) data.hpCurrent = Math.min(input.hpCurrent ?? c.hpCurrent, hpMax);
  }
  await prisma.combatant.update({ where: { id: c.id }, data });
  await touch(c.encounterId);
  await sendEncounter(req, res, c.encounterId);
});

/** Schaden/Heilung für Monster, begrenzt auf 0 … LP-Maximum */
combatRouter.post('/combatants/:id/hp', requireEditor, async (req, res) => {
  const c = await loadCombatant(req, String(req.params.id));
  if (c.kind !== 'monster') throw badRequest('character_read_only', 'Character values come from the character sheet');
  const { delta } = validate(hpDeltaSchema, req.body);
  await prisma.combatant.update({ where: { id: c.id }, data: { hpCurrent: Math.max(0, Math.min(c.hpMax, c.hpCurrent + delta)) } });
  await touch(c.encounterId);
  await sendEncounter(req, res, c.encounterId);
});

combatRouter.delete('/combatants/:id', requireEditor, async (req, res) => {
  const c = await loadCombatant(req, String(req.params.id));
  await prisma.combatant.delete({ where: { id: c.id } });
  await prisma.encounter.updateMany({ where: { id: c.encounterId, turnCombatantId: c.id }, data: { turnCombatantId: null } });
  await touch(c.encounterId);
  await sendEncounter(req, res, c.encounterId);
});
