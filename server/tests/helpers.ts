import request from 'supertest';
import type { SpellInput } from '@zauberbuch/shared';
import { createApp } from '../src/app';
import { ensureAdmin, seedExamples } from '../src/bootstrap';
import { prisma } from '../src/lib/prisma';

export const app = createApp({ accessLog: false });

/** Header für schreibende Requests (CSRF-Schutz) */
export const CSRF = { 'X-Requested-With': 'zauberbuch' };

export async function resetDb({ seed = false } = {}) {
  await prisma.dmNote.deleteMany();
  await prisma.wikiEntry.deleteMany();
  await prisma.source.deleteMany();
  await prisma.source.createMany({
    data: [
      { id: 'src_phb', name: 'Spielerhandbuch', abbreviation: 'SHB' },
      { id: 'src_tce', name: 'Tashas Kessel der Schöpfung', abbreviation: 'TKS' },
      { id: 'src_xge', name: 'Xanathars Ratgeber für alles', abbreviation: 'XRA' },
    ],
  });
  await prisma.catalogItem.deleteMany({ where: { storyId: { not: null } } });
  await prisma.catalogItem.deleteMany();
  await prisma.magicItemHolder.deleteMany();
  await prisma.magicItem.deleteMany();
  await prisma.bestiaryEntry.deleteMany();
  await prisma.monsterTemplate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.combatant.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.boardRead.deleteMany();
  await prisma.boardComment.deleteMany();
  await prisma.boardPost.deleteMany();
  await prisma.storyMember.deleteMany();
  await prisma.story.deleteMany();
  await prisma.characterEditor.deleteMany();
  await prisma.character.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.spellClassLink.deleteMany();
  await prisma.spellTranslation.deleteMany();
  await prisma.spell.deleteMany();
  await prisma.user.deleteMany();
  await ensureAdmin();
  if (seed) await seedExamples(true);
}

/** Liefert einen supertest-Agent mit gesetztem Login-Cookie. */
export async function loginAs(identifier: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').set(CSRF).send({ identifier, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** Legt per Admin-API einen Benutzer an und liefert einen eingeloggten Agent. */
export async function createUser(username: string, role: 'user' | 'dungeonmaster' | 'admin' = 'user', password = 'password123') {
  const admin = await loginAs('admin', 'admin-password');
  const res = await admin.post('/api/users').set(CSRF).send({ username, email: `${username}@example.com`, password, role });
  if (res.status !== 201) throw new Error(`Create user failed: ${res.status} ${JSON.stringify(res.body)}`);
  const agent = await loginAs(username, password);
  return { agent, user: res.body.user as { id: string } };
}

export function makeSpell(overrides: Partial<SpellInput> = {}): SpellInput {
  return {
    slug: 'test-spell',
    level: 2,
    school: 'illusion',
    castingTime: 'action',
    range: '30 ft',
    components: { verbal: true, somatic: false, material: false },
    concentration: true,
    ritual: false,
    duration: '1 minute',
    classes: ['bard'],
    source: 'Homebrew',
    isHomebrew: true,
    translations: {
      de: { name: 'Testzauber', description: 'Ein **Test**.' },
      en: { name: 'Test Spell', description: 'A **test**.' },
    },
    ...overrides,
  };
}

export { request, prisma };
