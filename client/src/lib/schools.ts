import type { School } from '@zauberbuch/shared';

/** Akzentfarbe je Zauberschule (als CSS-Farbe; wird per CSS-Variable --accent genutzt). */
export const SCHOOL_COLORS: Record<School, string> = {
  abjuration: '#2f6fbd',
  conjuration: '#b8860b',
  divination: '#0e8a9a',
  enchantment: '#c0397a',
  evocation: '#c2362b',
  illusion: '#7b46c7',
  necromancy: '#3f7a3a',
  transmutation: '#c4651c',
};

export const SCHOOL_GLYPHS: Record<School, string> = {
  abjuration: '🛡',
  conjuration: '✦',
  divination: '👁',
  enchantment: '♥',
  evocation: '🔥',
  illusion: '◐',
  necromancy: '☠',
  transmutation: '⚗',
};
