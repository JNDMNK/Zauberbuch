import type { SpellInput } from '@zauberbuch/shared';

/**
 * Beispielzauber für SEED_EXAMPLES=true. Die Regeltexte sind eigenständige, gekürzte
 * Zusammenfassungen (angelehnt an das SRD 5.1, CC-BY-4.0, Wizards of the Coast).
 */
export const exampleSpells: SpellInput[] = [
  {
    slug: 'fireball',
    level: 3,
    school: 'evocation',
    castingTime: 'action',
    range: '150 ft',
    components: { verbal: true, somatic: true, material: true },
    concentration: false,
    ritual: false,
    duration: 'instantaneous',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
    isHomebrew: false,
    damageDice: '8d6',
    damageType: 'fire',
    translations: {
      de: {
        name: 'Feuerball',
        castingTimeText: '1 Aktion',
        rangeText: '45 m',
        durationText: 'Unmittelbar',
        materialDescription: 'Eine winzige Kugel aus Fledermausguano und Schwefel',
        description:
          'Ein heller Lichtstreif schießt von deinem Finger zu einem Punkt deiner Wahl in Reichweite und erblüht dort mit einem dumpfen Grollen zu einer Explosion aus Flammen.\n\nJede Kreatur in einer **Kugel mit 6 m Radius** um diesen Punkt muss einen **Geschicklichkeitsrettungswurf** ablegen. Bei einem Misserfolg erleidet sie **8W6 Feuerschaden**, bei einem Erfolg die Hälfte.\n\nDas Feuer breitet sich um Ecken aus und entzündet brennbare Gegenstände im Wirkungsbereich, die weder getragen noch gehalten werden.',
        higherLevels:
          'Wirkst du diesen Zauber mit einem Zauberplatz des 4. Grades oder höher, steigt der Schaden um **1W6** für jeden Grad über dem 3.',
      },
      en: {
        name: 'Fireball',
        castingTimeText: '1 action',
        rangeText: '150 feet',
        durationText: 'Instantaneous',
        materialDescription: 'A tiny ball of bat guano and sulfur',
        description:
          'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.\n\nEach creature in a **20-foot-radius sphere** centered on that point must make a **Dexterity saving throw**. A target takes **8d6 fire damage** on a failed save, or half as much on a successful one.\n\nThe fire spreads around corners and ignites flammable objects in the area that aren\'t being worn or carried.',
        higherLevels:
          'When you cast this spell using a spell slot of 4th level or higher, the damage increases by **1d6** for each slot level above 3rd.',
      },
    },
  },
  {
    slug: 'magic-missile',
    level: 1,
    school: 'evocation',
    castingTime: 'action',
    range: '120 ft',
    components: { verbal: true, somatic: true, material: false },
    concentration: false,
    ritual: false,
    duration: 'instantaneous',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
    isHomebrew: false,
    damageDice: '1d4+1',
    damageType: 'force',
    translations: {
      de: {
        name: 'Magisches Geschoss',
        castingTimeText: '1 Aktion',
        rangeText: '36 m',
        durationText: 'Unmittelbar',
        description:
          'Du erschaffst **drei leuchtende Pfeile** aus magischer Kraft. Jeder Pfeil trifft eine Kreatur deiner Wahl, die du in Reichweite sehen kannst, und verursacht **1W4 + 1 Energieschaden**.\n\nDie Pfeile treffen alle gleichzeitig, und du kannst sie auf ein oder mehrere Ziele verteilen.',
        higherLevels:
          'Wirkst du diesen Zauber mit einem Zauberplatz des 2. Grades oder höher, erschaffst du für jeden Grad über dem 1. **einen zusätzlichen Pfeil**.',
      },
      en: {
        name: 'Magic Missile',
        castingTimeText: '1 action',
        rangeText: '120 feet',
        durationText: 'Instantaneous',
        description:
          'You create **three glowing darts** of magical force. Each dart hits a creature of your choice that you can see within range and deals **1d4 + 1 force damage** to its target.\n\nThe darts all strike simultaneously, and you can direct them to hit one creature or several.',
        higherLevels:
          'When you cast this spell using a spell slot of 2nd level or higher, the spell creates **one more dart** for each slot level above 1st.',
      },
    },
  },
  {
    slug: 'healing-word',
    level: 1,
    school: 'evocation',
    castingTime: 'bonus_action',
    range: '60 ft',
    components: { verbal: true, somatic: false, material: false },
    concentration: false,
    ritual: false,
    duration: 'instantaneous',
    classes: ['bard', 'cleric', 'druid'],
    source: 'SRD',
    isHomebrew: false,
    damageDice: '1d4+mod',
    damageType: 'healing',
    translations: {
      de: {
        name: 'Heilendes Wort',
        castingTimeText: '1 Bonusaktion',
        rangeText: '18 m',
        durationText: 'Unmittelbar',
        description:
          'Eine Kreatur deiner Wahl, die du in Reichweite sehen kannst, erhält Trefferpunkte in Höhe von **1W4 + deinem Zauberattributsmodifikator** zurück.\n\nDer Zauber wirkt nicht auf Untote und Konstrukte.',
        higherLevels:
          'Wirkst du diesen Zauber mit einem Zauberplatz des 2. Grades oder höher, steigt die Heilung um **1W4** für jeden Grad über dem 1.',
      },
      en: {
        name: 'Healing Word',
        castingTimeText: '1 bonus action',
        rangeText: '60 feet',
        durationText: 'Instantaneous',
        description:
          'A creature of your choice that you can see within range regains hit points equal to **1d4 + your spellcasting ability modifier**.\n\nThis spell has no effect on undead or constructs.',
        higherLevels:
          'When you cast this spell using a spell slot of 2nd level or higher, the healing increases by **1d4** for each slot level above 1st.',
      },
    },
  },
  {
    slug: 'shield',
    level: 1,
    school: 'abjuration',
    castingTime: 'reaction',
    range: 'self',
    components: { verbal: true, somatic: true, material: false },
    concentration: false,
    ritual: false,
    duration: '1 round',
    classes: ['sorcerer', 'wizard'],
    source: 'SRD',
    isHomebrew: false,
    translations: {
      de: {
        name: 'Schild',
        castingTimeText: '1 Reaktion, die du ausführst, wenn du von einem Angriff getroffen wirst oder Ziel des Zaubers „Magisches Geschoss“ bist',
        rangeText: 'Selbst',
        durationText: '1 Runde',
        description:
          'Eine unsichtbare Barriere aus magischer Kraft erscheint und schützt dich. Bis zum Beginn deines nächsten Zuges erhältst du einen **Bonus von +5 auf deine RK**, auch gegen den auslösenden Angriff.\n\nAußerdem erleidest du keinen Schaden durch *Magisches Geschoss*.',
      },
      en: {
        name: 'Shield',
        castingTimeText: '1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell',
        rangeText: 'Self',
        durationText: '1 round',
        description:
          'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a **+5 bonus to AC**, including against the triggering attack.\n\nYou also take no damage from *magic missile*.',
      },
    },
  },
  {
    slug: 'light',
    level: 0,
    school: 'evocation',
    castingTime: 'action',
    range: 'touch',
    components: { verbal: true, somatic: false, material: true },
    concentration: false,
    ritual: false,
    duration: '1 hour',
    classes: ['bard', 'cleric', 'sorcerer', 'wizard', 'artificer'],
    source: 'SRD',
    isHomebrew: false,
    translations: {
      de: {
        name: 'Licht',
        castingTimeText: '1 Aktion',
        rangeText: 'Berührung',
        durationText: '1 Stunde',
        materialDescription: 'Ein Glühwürmchen oder phosphoreszierendes Moos',
        description:
          'Du berührst einen Gegenstand, der in keiner Dimension größer als 3 m ist. Bis der Zauber endet, verbreitet der Gegenstand **helles Licht in 6 m Radius** und dämmriges Licht weitere 6 m. Das Licht kann eine Farbe deiner Wahl haben.\n\nDas vollständige Bedecken des Gegenstands mit etwas Lichtundurchlässigem blockiert das Licht. Der Zauber endet, wenn du ihn erneut wirkst oder ihn als Aktion beendest.\n\nHält oder trägt eine feindlich gesinnte Kreatur den Gegenstand, muss sie einen **Geschicklichkeitsrettungswurf** bestehen, um dem Zauber zu entgehen.',
      },
      en: {
        name: 'Light',
        castingTimeText: '1 action',
        rangeText: 'Touch',
        durationText: '1 hour',
        materialDescription: 'A firefly or phosphorescent moss',
        description:
          'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds **bright light in a 20-foot radius** and dim light for an additional 20 feet. The light can be colored as you like.\n\nCompletely covering the object with something opaque blocks the light. The spell ends if you cast it again or dismiss it as an action.\n\nIf you target an object held or worn by a hostile creature, that creature must succeed on a **Dexterity saving throw** to avoid the spell.',
      },
    },
  },
];
