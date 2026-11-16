import request from 'supertest';
import type { SpellInput } from '@zauberbuch/shared';
import { createApp } from '../src/app';
import { ensureAdmin, seedExamples } from '../src/bootstrap';
import { prisma } from '../src/lib/prisma';

export const app = createApp({ accessLog: false });

/** Header für schreibende Requests (CSRF-Schutz) */
export const CSRF = { 'X-Requested-With': 'zauberbuch' };

export async function resetDb({ seed = false } = {}) {
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

export async function registerUser(username: string, password = 'password123') {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .set(CSRF)
    .send({ username, email: `${username}@example.com`, password });
  if (res.status !== 201) throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
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
