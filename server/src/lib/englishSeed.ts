import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Englische Fassung der Grundausstattung (Namen nach dem System Reference Document 5.1, CC-BY-4.0, Wizards of the
 * Coast; Beschreibungen selbst formuliert). Zuordnung über den deutschen Namen – so lassen sich neue Datenbanken
 * befüllen und bestehende nachtragen, ohne eigene Einträge zu überschreiben.
 */

export interface EnText {
  name: string;
  summary?: string;
  description?: string;
}

// ---------------------------------------------------------------- Gegenstands-Datenbank

const TOOL = 'If you are proficient, you add your proficiency bonus to ability checks made with these tools. Each type of artisan’s tools requires a separate proficiency.';
const GAME = 'If you are proficient, you add your proficiency bonus to ability checks to play this game. Each type of gaming set requires a separate proficiency.';
const MUSIC = 'If you are proficient, you add your proficiency bonus to ability checks to play music with this instrument. Each type of instrument requires a separate proficiency.';

export const CATALOG_EN: Record<string, { name: string; description: string }> = {
  // Waffen
  Knüppel: { name: 'Club', description: 'Simple melee weapon. Light.' },
  Dolch: { name: 'Dagger', description: 'Simple melee weapon. Finesse, light, thrown (range 6/18 m).' },
  Zweihandknüppel: { name: 'Greatclub', description: 'Simple melee weapon. Two-handed.' },
  Beil: { name: 'Handaxe', description: 'Simple melee weapon. Light, thrown (range 6/18 m).' },
  Wurfspeer: { name: 'Javelin', description: 'Simple melee weapon. Thrown (range 9/36 m).' },
  'Leichter Hammer': { name: 'Light hammer', description: 'Simple melee weapon. Light, thrown (range 6/18 m).' },
  Streitkolben: { name: 'Mace', description: 'Simple melee weapon.' },
  Kampfstab: { name: 'Quarterstaff', description: 'Simple melee weapon. Versatile (1d8).' },
  Sichel: { name: 'Sickle', description: 'Simple melee weapon. Light.' },
  Speer: { name: 'Spear', description: 'Simple melee weapon. Thrown (range 6/18 m), versatile (1d8).' },
  'Leichte Armbrust': { name: 'Light crossbow', description: 'Simple ranged weapon. Ammunition (range 24/96 m), loading, two-handed.' },
  Wurfpfeil: { name: 'Dart', description: 'Simple ranged weapon. Finesse, thrown (range 6/18 m).' },
  Kurzbogen: { name: 'Shortbow', description: 'Simple ranged weapon. Ammunition (range 24/96 m), two-handed.' },
  Schleuder: { name: 'Sling', description: 'Simple ranged weapon. Ammunition (range 9/36 m).' },
  Streitaxt: { name: 'Battleaxe', description: 'Martial melee weapon. Versatile (1d10).' },
  Flegel: { name: 'Flail', description: 'Martial melee weapon.' },
  Glefe: { name: 'Glaive', description: 'Martial melee weapon. Heavy, reach, two-handed.' },
  Zweihandaxt: { name: 'Greataxe', description: 'Martial melee weapon. Heavy, two-handed.' },
  Zweihandschwert: { name: 'Greatsword', description: 'Martial melee weapon. Heavy, two-handed.' },
  Hellebarde: { name: 'Halberd', description: 'Martial melee weapon. Heavy, reach, two-handed.' },
  Lanze: { name: 'Lance', description: 'Martial melee weapon. Reach, special (disadvantage within 1.5 m; one-handed when mounted).' },
  Langschwert: { name: 'Longsword', description: 'Martial melee weapon. Versatile (1d10).' },
  Zweihandhammer: { name: 'Maul', description: 'Martial melee weapon. Heavy, two-handed.' },
  Morgenstern: { name: 'Morningstar', description: 'Martial melee weapon.' },
  Pike: { name: 'Pike', description: 'Martial melee weapon. Heavy, reach, two-handed.' },
  Rapier: { name: 'Rapier', description: 'Martial melee weapon. Finesse.' },
  Krummsäbel: { name: 'Scimitar', description: 'Martial melee weapon. Finesse, light.' },
  Kurzschwert: { name: 'Shortsword', description: 'Martial melee weapon. Finesse, light.' },
  Dreizack: { name: 'Trident', description: 'Martial melee weapon. Thrown (range 6/18 m), versatile (1d8).' },
  Kriegspicke: { name: 'War pick', description: 'Martial melee weapon.' },
  Kriegshammer: { name: 'Warhammer', description: 'Martial melee weapon. Versatile (1d10).' },
  Peitsche: { name: 'Whip', description: 'Martial melee weapon. Finesse, reach.' },
  Blasrohr: { name: 'Blowgun', description: 'Martial ranged weapon. Ammunition (range 7.5/30 m), loading.' },
  Handarmbrust: { name: 'Hand crossbow', description: 'Martial ranged weapon. Ammunition (range 9/36 m), light, loading.' },
  'Schwere Armbrust': { name: 'Heavy crossbow', description: 'Martial ranged weapon. Ammunition (range 30/120 m), heavy, loading, two-handed.' },
  Langbogen: { name: 'Longbow', description: 'Martial ranged weapon. Ammunition (range 45/180 m), heavy, two-handed.' },
  Netz: { name: 'Net', description: 'Martial ranged weapon. Thrown (range 1.5/4.5 m). A Large or smaller creature hit is restrained (escape: DC 10 Strength check or 5 slashing damage to the net).' },
  // Rüstung
  'Gepolsterte Rüstung': { name: 'Padded armor', description: 'Light armor. Disadvantage on Dexterity (Stealth) checks.' },
  Lederrüstung: { name: 'Leather armor', description: 'Light armor made of hardened leather.' },
  'Beschlagene Lederrüstung': { name: 'Studded leather armor', description: 'Light armor reinforced with rivets or spikes.' },
  Fellrüstung: { name: 'Hide armor', description: 'Medium armor made of thick furs and pelts.' },
  Kettenhemd: { name: 'Chain shirt', description: 'Medium armor of interlocking metal rings, worn under clothing.' },
  Schuppenpanzer: { name: 'Scale mail', description: 'Medium armor. Disadvantage on Dexterity (Stealth) checks.' },
  Brustplatte: { name: 'Breastplate', description: 'Medium armor protecting chest and back.' },
  Halbplattenpanzer: { name: 'Half plate', description: 'Medium armor. Disadvantage on Dexterity (Stealth) checks.' },
  Ringpanzer: { name: 'Ring mail', description: 'Heavy armor. Disadvantage on Dexterity (Stealth) checks.' },
  Kettenpanzer: { name: 'Chain mail', description: 'Heavy armor. Strength 13 required, disadvantage on Dexterity (Stealth) checks.' },
  Schienenpanzer: { name: 'Splint armor', description: 'Heavy armor. Strength 15 required, disadvantage on Dexterity (Stealth) checks.' },
  Plattenpanzer: { name: 'Plate armor', description: 'Heavy armor. Strength 15 required, disadvantage on Dexterity (Stealth) checks.' },
  Schild: { name: 'Shield', description: 'Carried in one hand; increases your Armor Class by 2.' },
  // Ausrüstung
  Heiltrank: { name: 'Potion of healing', description: 'A creature that drinks it regains hit points. Drinking or administering it takes an action.' },
  'Großer Heiltrank': { name: 'Potion of greater healing', description: 'A stronger potion of healing.' },
  'Gegengift (Phiole)': { name: 'Antitoxin (vial)', description: 'Advantage on saving throws against poison for 1 hour.' },
  'Alchemistenfeuer (Flasche)': { name: 'Alchemist’s fire (flask)', description: 'Improvised thrown weapon (range 6 m); the target burns until it puts out the flames (DC 10 Dexterity).' },
  'Säure (Phiole)': { name: 'Acid (vial)', description: 'Improvised thrown weapon (range 6 m) against a creature or object.' },
  'Weihwasser (Flasche)': { name: 'Holy water (flask)', description: 'Improvised thrown weapon (range 6 m); only affects fiends and undead.' },
  'Öl (Flasche)': { name: 'Oil (flask)', description: 'Can be poured out and set alight; burns for 2 rounds.' },
  'Krähenfüße (Beutel mit 20)': { name: 'Caltrops (bag of 20)', description: 'Cover a 1.5 m square; a creature entering it makes a DC 15 Dexterity saving throw.' },
  'Kugellager (Beutel mit 1000)': { name: 'Ball bearings (bag of 1,000)', description: 'Cover a 3 m square; a creature moving across it may fall prone (DC 10 Dexterity).' },
  'Pfeile (20)': { name: 'Arrows (20)', description: 'Ammunition for bows.' },
  'Bolzen (20)': { name: 'Crossbow bolts (20)', description: 'Ammunition for crossbows.' },
  Köcher: { name: 'Quiver', description: 'Holds up to 20 arrows.' },
  Rucksack: { name: 'Backpack', description: 'Holds about 30 pounds of gear.' },
  Schlafsack: { name: 'Bedroll', description: 'For nights under the open sky.' },
  Decke: { name: 'Blanket', description: 'A warm woollen blanket.' },
  Fackel: { name: 'Torch', description: 'Burns for 1 hour; bright light in a 6 m radius and dim light for an additional 6 m.' },
  'Laterne (Kapuze)': { name: 'Lantern, hooded', description: 'Burns for 6 hours on a flask of oil; bright light 9 m, dim light an additional 9 m.' },
  Kerze: { name: 'Candle', description: 'Burns for 1 hour; bright light in a 1.5 m radius.' },
  Zunderkästchen: { name: 'Tinderbox', description: 'Flint, fire steel and tinder for lighting a fire.' },
  'Rationen (1 Tag)': { name: 'Rations (1 day)', description: 'Dry food suitable for travel.' },
  Wasserschlauch: { name: 'Waterskin', description: 'Holds about 2 litres when full.' },
  'Seil (Hanf, 15 m)': { name: 'Rope, hempen (15 m)', description: 'Has 2 hit points; can be burst with a DC 17 Strength check.' },
  'Seil (Seide, 15 m)': { name: 'Rope, silk (15 m)', description: 'Lighter than hempen rope.' },
  Kletterhaken: { name: 'Piton', description: 'For securing yourself while climbing.' },
  Enterhaken: { name: 'Grappling hook', description: 'For throwing and hooking onto ledges.' },
  Brechstange: { name: 'Crowbar', description: 'Advantage on Strength checks where leverage helps.' },
  Hammer: { name: 'Hammer', description: 'A simple tool hammer.' },
  Schaufel: { name: 'Shovel', description: 'For digging.' },
  'Spiegel (Stahl)': { name: 'Mirror, steel', description: 'A small hand mirror.' },
  Heilerausrüstung: { name: 'Healer’s kit', description: '10 uses: stabilize a creature at 0 hit points without a Wisdom (Medicine) check.' },
  Kletterausrüstung: { name: 'Climber’s kit', description: 'Pitons, boot tips, gloves and a harness.' },
  'Kreide (1 Stück)': { name: 'Chalk (1 piece)', description: 'For marking paths.' },
  'Tinte und Feder': { name: 'Ink and pen', description: 'A bottle of ink (30 ml) and a quill.' },
  'Pergament (1 Blatt)': { name: 'Parchment (one sheet)', description: 'For writing and drawing.' },
  'Zelt (2 Personen)': { name: 'Tent, two-person', description: 'A simple canvas tent.' },
  // Werkzeuge
  Alchemistenausrüstung: { name: 'Alchemist’s supplies', description: `Supplies for making and examining alchemical substances. ${TOOL}` },
  Brauerausrüstung: { name: 'Brewer’s supplies', description: `Kettles, barrels and ingredients for brewing beer and ale. ${TOOL}` },
  Kalligrafieausrüstung: { name: 'Calligrapher’s supplies', description: `Inks, quills and parchment for ornate writing. ${TOOL}` },
  Zimmermannswerkzeug: { name: 'Carpenter’s tools', description: `Saw, hammer, nails, hatchet and square for woodwork. ${TOOL}` },
  Kartografenwerkzeug: { name: 'Cartographer’s tools', description: `Quills, ink, parchment, compass and rule for drawing maps. ${TOOL}` },
  Schusterwerkzeug: { name: 'Cobbler’s tools', description: `Hammer, awl, knife, lasts and thread for making and mending footwear. ${TOOL}` },
  Kochutensilien: { name: 'Cook’s utensils', description: `Pot, knives, forks, stirring spoon and ladle. ${TOOL}` },
  Glasbläserwerkzeug: { name: 'Glassblower’s tools', description: `Blowpipe, tongs and moulds for working glass. ${TOOL}` },
  Juwelierswerkzeug: { name: 'Jeweler’s tools', description: `Fine saws, files, pliers and a loupe for gems and jewellery. ${TOOL}` },
  Lederverarbeitungswerkzeug: { name: 'Leatherworker’s tools', description: `Knife, awl, hammer and thread for working leather. ${TOOL}` },
  Steinmetzwerkzeug: { name: 'Mason’s tools', description: `Trowel, hammer, chisel, brushes and square for stonework. ${TOOL}` },
  Malerausrüstung: { name: 'Painter’s supplies', description: `Easel, canvas, paints and brushes. ${TOOL}` },
  Töpferwerkzeug: { name: 'Potter’s tools', description: `Wheel accessories, knives and scrapers for shaping clay. ${TOOL}` },
  Schmiedewerkzeug: { name: 'Smith’s tools', description: `Hammers, tongs, charcoal, rags and a whetstone for metalwork. ${TOOL}` },
  Kesselflickerwerkzeug: { name: 'Tinker’s tools', description: `Tools, wire, cloth and glue for repairing items or building small devices. ${TOOL}` },
  Weberwerkzeug: { name: 'Weaver’s tools', description: `Thread, needles and scraps of cloth for weaving, sewing and mending. ${TOOL}` },
  Holzschnitzerwerkzeug: { name: 'Woodcarver’s tools', description: `Knife, gouges and small saws for carving wood. ${TOOL}` },
  Würfelspiel: { name: 'Dice set', description: `A set of dice for various games of chance. ${GAME}` },
  Kartenspiel: { name: 'Playing card set', description: `A deck of cards for games such as Three-Dragon Ante. ${GAME}` },
  Dudelsack: { name: 'Bagpipes', description: `Wind instrument with an air bag and pipes. ${MUSIC}` },
  Trommel: { name: 'Drum', description: `Percussion instrument, often covered with hide. ${MUSIC}` },
  Hackbrett: { name: 'Dulcimer', description: `String instrument played with small hammers. ${MUSIC}` },
  Flöte: { name: 'Flute', description: `A simple woodwind instrument. ${MUSIC}` },
  Laute: { name: 'Lute', description: `Plucked string instrument – the classic instrument of bards. ${MUSIC}` },
  Leier: { name: 'Lyre', description: `A small plucked string instrument. ${MUSIC}` },
  Horn: { name: 'Horn', description: `Wind instrument made of animal horn or metal. ${MUSIC}` },
  Panflöte: { name: 'Pan flute', description: `Several pipes of different lengths bound together. ${MUSIC}` },
  Schalmei: { name: 'Shawm', description: `Double-reed wind instrument with a piercing sound. ${MUSIC}` },
  Gambe: { name: 'Viol', description: `A bowed string instrument. ${MUSIC}` },
  Navigationswerkzeug: { name: 'Navigator’s tools', description: 'Instruments for navigating at sea. If proficient, you can chart a ship’s course and follow navigation charts, and you add your proficiency bonus to checks to avoid getting lost at sea.' },
  Diebeswerkzeug: { name: 'Thieves’ tools', description: 'A small file, lock picks, a small mirror on a metal handle, narrow scissors and pliers. If proficient, you add your proficiency bonus to checks to disarm traps or open locks.' },
  Verkleidungsausrüstung: { name: 'Disguise kit', description: 'Cosmetics, hair dye and small props to change your appearance. If proficient, you add your proficiency bonus to checks to create a disguise.' },
  Fälscherausrüstung: { name: 'Forgery kit', description: 'Papers, parchments, pens, inks, seals, wax, gold and silver leaf for forging documents. If proficient, you add your proficiency bonus to checks to create a forgery.' },
  Kräuterkundeausrüstung: { name: 'Herbalism kit', description: 'Clippers, mortar and pestle, pouches and vials for remedies and potions. If proficient, you add your proficiency bonus to checks to identify or apply herbs; you can make antitoxin and potions of healing.' },
  Giftmischerausrüstung: { name: 'Poisoner’s kit', description: 'Vials, chemicals and tools for making poisons. If proficient, you add your proficiency bonus to checks to craft or use poisons.' },
};

// ---------------------------------------------------------------- Quellen

export const SOURCES_EN: Record<string, { name: string; abbreviation: string }> = {
  Spielerhandbuch: { name: 'Player’s Handbook', abbreviation: 'PHB' },
  'Tashas Kessel der Schöpfung': { name: 'Tasha’s Cauldron of Everything', abbreviation: 'TCE' },
  'Xanathars Ratgeber für alles': { name: 'Xanathar’s Guide to Everything', abbreviation: 'XGE' },
  'Monsterhandbuch': { name: 'Monster Manual', abbreviation: 'MM' },
  'Spielleiterhandbuch': { name: 'Dungeon Master’s Guide', abbreviation: 'DMG' },
  'System Reference Document 5.1': { name: 'System Reference Document 5.1', abbreviation: 'SRD' },
};

// ---------------------------------------------------------------- Wiki

const god = (name: string, summary: string): EnText => ({ name, summary });

export const WIKI_EN: Record<string, Record<string, EnText>> = {
  race: {
    Zwerg: { name: 'Dwarf', summary: 'Bold, hardy and steeped in tradition – masters of stone and forge.', description: 'Dwarves live in mountain strongholds and mines, value craftsmanship, honour and clan, and never forget a favour or a grudge.' },
    Elf: { name: 'Elf', summary: 'Graceful, long-lived and gifted in magic – at home in forests and towers.', description: 'Elves dwell in places of ethereal beauty, love nature, art and magic, and view the world with the calm of many centuries.' },
    Halbling: { name: 'Halfling', summary: 'Small, friendly and remarkably lucky – lovers of hearth and home.', description: 'Halflings value peace, good food and community. Their courage and luck often surprise even great heroes.' },
    Mensch: { name: 'Human', summary: 'Versatile, ambitious and adaptable – the youngest and most widespread people.', description: 'Humans live shorter lives than other peoples and therefore strive to achieve as much as they can in their lifetime.' },
    Drachenblütiger: { name: 'Dragonborn', summary: 'Proud descendants of dragons with a breath weapon and draconic scales.', description: 'Dragonborn look like dragons walking upright in humanoid form. They value honour, clan and self-improvement.' },
    Gnom: { name: 'Gnome', summary: 'Curious, inventive and full of life – small tinkerers with big minds.', description: 'Gnomes are full of energy and enthusiasm; they love to invent, explore and laugh.' },
    Halbelf: { name: 'Half-Elf', summary: 'Between two worlds – charming, versatile and freedom-loving.', description: 'Half-elves combine the curiosity and ambition of humans with the grace and keen senses of elves.' },
    Halbork: { name: 'Half-Orc', summary: 'Strong, enduring and intimidating – shaped by orcish blood.', description: 'Half-orcs fight for their place between humans and orcs and prove their worth through strength and determination.' },
    Tiefling: { name: 'Tiefling', summary: 'Marked by an infernal heritage – viewed with suspicion, but strong-willed.', description: 'Tieflings carry the blood of the Nine Hells: horns, a tail and fiery eyes betray their ancestry.' },
  },
  class: {
    Barbar: { name: 'Barbarian', summary: 'A fierce warrior who defies pain and danger in a battle rage.', description: 'Barbarians draw their strength from primal fury. While raging they become stronger and tougher than any other fighter.' },
    Barde: { name: 'Bard', summary: 'An inspiring performer whose music and words unleash magic.', description: 'Bards weave magic from songs, stories and words. They inspire their allies and confound their foes.' },
    Kleriker: { name: 'Cleric', summary: 'A devoted servant of a deity who channels divine power.', description: 'Clerics are intermediaries between mortals and the gods. They heal, protect and smite with the power of their faith.' },
    Druide: { name: 'Druid', summary: 'A guardian of nature who commands the elements and takes animal form.', description: 'Druids revere nature itself. They wield nature magic and can take the shape of beasts.' },
    Kämpfer: { name: 'Fighter', summary: 'A master of weapons and armor with unmatched combat experience.', description: 'Fighters master every weapon and armor. Whether knight, mercenary or champion – they are the backbone of any party.' },
    Mönch: { name: 'Monk', summary: 'An ascetic martial artist who channels ki through body and mind.', description: 'Monks harness the energy of ki to reach superhuman speed and striking power – without any armor.' },
    Paladin: { name: 'Paladin', summary: 'A holy warrior granted divine powers by a sacred oath.', description: 'Paladins are bound by a sacred oath. They combine martial skill with divine magic, healing and protective auras.' },
    Waldläufer: { name: 'Ranger', summary: 'A hunter and scout of the wilderness with nature magic.', description: 'Rangers roam the wilds, hunt dangerous creatures and guard the borders of civilization.' },
    Schurke: { name: 'Rogue', summary: 'A skilled specialist in stealth, traps and precise attacks.', description: 'Rogues rely on cunning, skill and precision. They find a way where others fail.' },
    Zauberer: { name: 'Sorcerer', summary: 'A born spellcaster whose power comes from their blood.', description: 'Sorcerers carry innate magic – through a bloodline or an extraordinary event – and shape it by force of will.' },
    Hexenmeister: { name: 'Warlock', summary: 'A spellcaster who gains power through a pact with a patron.', description: 'Warlocks forge pacts with mighty otherworldly beings and receive spells and eldritch abilities in return.' },
    Magier: { name: 'Wizard', summary: 'A scholarly spellcaster who masters magic through study and a spellbook.', description: 'Wizards unravel the secrets of magic through years of study. Their spellbook is their most precious possession.' },
  },
  background: {
    Tempeldiener: { name: 'Acolyte', summary: 'You have spent your life in the service of a temple, acting as an intermediary between the faithful and the divine.', description: 'You served in a temple dedicated to a specific god or pantheon. You perform sacred rites, offer sacrifices and guide worshippers in their faith. Whether you are also a cleric depends on your class.' },
  },
  feat: {
    Ringer: { name: 'Grappler', summary: 'Trained in close-quarters fighting – you hold foes fast and pin them down.', description: 'You have developed the skills necessary to hold your own in close-quarters grappling.' },
  },
  language: {
    Gemeinsprache: { name: 'Common', summary: 'The trade language of most lands.' },
    Zwergisch: { name: 'Dwarvish', summary: 'A guttural language full of hard consonants.' },
    Elfisch: { name: 'Elvish', summary: 'A fluid, melodic language with subtle intonation.' },
    Riesisch: { name: 'Giant', summary: 'The language of giants and their kin.' },
    Gnomisch: { name: 'Gnomish', summary: 'Known for technical terms and long names.' },
    Goblinisch: { name: 'Goblin', summary: 'The language of goblins, bugbears and hobgoblins.' },
    Halblingisch: { name: 'Halfling', summary: 'Rarely heard outside halfling communities.' },
    Orkisch: { name: 'Orc', summary: 'A rough, harsh language full of war terms.' },
    Abyssisch: { name: 'Abyssal', summary: 'The chaotic language of the Abyss.' },
    Celestisch: { name: 'Celestial', summary: 'The language of the celestial planes.' },
    Drakonisch: { name: 'Draconic', summary: 'Considered one of the oldest languages; often used for magic.' },
    Tiefensprache: { name: 'Deep Speech', summary: 'The alien language of beings from the Far Realm; it has no script of its own.' },
    Infernalisch: { name: 'Infernal', summary: 'The orderly, strict language of the Nine Hells.' },
    Urtümlich: { name: 'Primordial', summary: 'The language of the elemental planes, with the dialects Aquan, Auran, Ignan and Terran.' },
    Sylvanisch: { name: 'Sylvan', summary: 'The language of the Feywild.' },
    'Gemeinsprache der Unterreiche': { name: 'Undercommon', summary: 'The trade language of the peoples of the Underdark.' },
  },
  god: {
    'Der Daghdha': god('The Daghdha', 'God of weather and crops'),
    Arawn: god('Arawn', 'God of life and death'),
    Belenus: god('Belenus', 'God of sun, light and warmth'),
    Brigantia: god('Brigantia', 'Goddess of rivers and livestock'),
    Diancecht: god('Diancecht', 'God of medicine and healing'),
    Dunatis: god('Dunatis', 'God of mountains and peaks'),
    Goibhniu: god('Goibhniu', 'God of smiths and healing'),
    Lugh: god('Lugh', 'God of arts, travel and commerce'),
    'Manannan mac Lir': god('Manannan mac Lir', 'God of oceans and sea creatures'),
    'Math Mathonwy': god('Math Mathonwy', 'God of magic'),
    Morrigan: god('Morrigan', 'Goddess of battle'),
    Nuada: god('Nuada', 'God of war and warriors'),
    Oghma: god('Oghma', 'God of speech and writing'),
    Silvanus: god('Silvanus', 'God of nature and forests'),
    Zeus: god('Zeus', 'God of the sky, ruler of the gods'),
    Aphrodite: god('Aphrodite', 'Goddess of love and beauty'),
    Apollon: god('Apollo', 'God of light, music and healing'),
    Ares: god('Ares', 'God of war and strife'),
    Artemis: god('Artemis', 'Goddess of hunting and childbirth'),
    Athene: god('Athena', 'Goddess of wisdom and civilization'),
    Demeter: god('Demeter', 'Goddess of agriculture'),
    Dionysos: god('Dionysus', 'God of mirth and wine'),
    Hades: god('Hades', 'God of the underworld'),
    Hekate: god('Hecate', 'Goddess of magic and the moon'),
    Hephaistos: god('Hephaestus', 'God of smithing and craft'),
    Hera: god('Hera', 'Goddess of marriage and intrigue'),
    Herakles: god('Hercules', 'God of strength and adventure'),
    Hermes: god('Hermes', 'God of travel and commerce'),
    Hestia: god('Hestia', 'Goddess of home and family'),
    Nike: god('Nike', 'Goddess of victory'),
    Pan: god('Pan', 'God of nature'),
    Poseidon: god('Poseidon', 'God of the sea and earthquakes'),
    Tyche: god('Tyche', 'Goddess of good fortune'),
    'Re-Harachte': god('Re-Horakhty', 'God of the sun, ruler of the gods'),
    Anubis: god('Anubis', 'God of judgment and death'),
    Apep: god('Apep', 'God of evil, fire and serpents'),
    Bastet: god('Bast', 'Goddess of cats and vengeance'),
    Bes: god('Bes', 'God of luck and music'),
    Hathor: god('Hathor', 'Goddess of love, music and motherhood'),
    Imhotep: god('Imhotep', 'God of crafts and medicine'),
    Isis: god('Isis', 'Goddess of fertility and magic'),
    Nephthys: god('Nephthys', 'Goddess of death and grief'),
    Osiris: god('Osiris', 'God of nature and the underworld'),
    Ptah: god('Ptah', 'God of crafts, knowledge and secrets'),
    Seth: god('Set', 'God of darkness and desert storms'),
    Sobek: god('Sobek', 'God of water and crocodiles'),
    Thot: god('Thoth', 'God of knowledge and wisdom'),
    Odin: god('Odin', 'God of knowledge and war'),
    Ägir: god('Aegir', 'God of the sea and storms'),
    Balder: god('Balder', 'God of beauty and poetry'),
    Forseti: god('Forseti', 'God of justice and law'),
    Freyr: god('Frey', 'God of fertility and the sun'),
    Freya: god('Freya', 'Goddess of fertility and love'),
    Frigg: god('Frigga', 'Goddess of birth and fertility'),
    Heimdall: god('Heimdall', 'God of watchfulness and loyalty'),
    Hel: god('Hel', 'Goddess of the underworld'),
    Hermodr: god('Hermod', 'God of luck'),
    Loki: god('Loki', 'God of thieves and trickery'),
    Njörd: god('Njord', 'God of sea and wind'),
    Odur: god('Odur', 'God of light and the sun'),
    Sif: god('Sif', 'Goddess of war'),
    Skadi: god('Skadi', 'Goddess of earth and mountains'),
    Surtr: god('Surtur', 'God of fire giants and war'),
    Thor: god('Thor', 'God of storms and thunder'),
    Thrym: god('Thrym', 'God of frost giants and cold'),
    Tyr: god('Tyr', 'God of courage and strategy'),
    Uller: god('Uller', 'God of hunting and winter'),
  },
  rule: {
    Blind: {
      name: 'Blinded',
      summary: 'The creature can’t see.',
      description: `- A blinded creature can’t see and automatically fails any ability check that requires sight.
- Attack rolls against the creature have advantage, and the creature’s attack rolls have disadvantage.`,
    },
    Bezaubert: {
      name: 'Charmed',
      summary: 'The creature regards the charmer as a friend.',
      description: `- A charmed creature can’t attack the charmer or target the charmer with harmful abilities or magical effects.
- The charmer has advantage on any ability check to interact socially with the creature.`,
    },
    Taub: { name: 'Deafened', summary: 'The creature can’t hear.', description: '- A deafened creature can’t hear and automatically fails any ability check that requires hearing.' },
    Erschöpfung: {
      name: 'Exhaustion',
      summary: 'Six levels of increasing exhaustion.',
      description: `Some special abilities and hazards (starvation, cold, forced marches …) can lead to exhaustion. It is measured in six levels; an effect can give a creature one or more levels.

| Level | Effect |
| --- | --- |
| 1 | Disadvantage on ability checks |
| 2 | Speed halved |
| 3 | Disadvantage on attack rolls and saving throws |
| 4 | Hit point maximum halved |
| 5 | Speed reduced to 0 |
| 6 | Death |

- An exhausted creature suffers the effect of its current level **and all lower levels**.
- Further exhaustion increases the level by the amount specified.
- An effect that removes exhaustion reduces the level accordingly; below level 1 the condition ends.
- Finishing a **long rest** with some food and drink reduces exhaustion by 1 level.`,
    },
    Verängstigt: {
      name: 'Frightened',
      summary: 'The creature fears the source of its fear.',
      description: `- A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.
- It can’t willingly move closer to the source of its fear.`,
    },
    Gepackt: {
      name: 'Grappled',
      summary: 'The creature is held and can’t move.',
      description: `- A grappled creature’s speed becomes 0, and it can’t benefit from any bonus to its speed.
- The condition ends if the grappler is incapacitated.
- It also ends if an effect removes the grappled creature from the grappler’s reach (for example when it is hurled away).
- See also **Grappling**.`,
    },
    Kampfunfähig: { name: 'Incapacitated', summary: 'The creature can’t take actions or reactions.', description: '- An incapacitated creature can’t take actions or reactions.' },
    Unsichtbar: {
      name: 'Invisible',
      summary: 'The creature can’t be seen without magic or a special sense.',
      description: `- An invisible creature is impossible to see without the aid of magic or a special sense. For the purpose of hiding, it is heavily obscured.
- Its location can be detected by any noise it makes or tracks it leaves.
- Attack rolls against the creature have disadvantage, and its attack rolls have advantage.`,
    },
    Gelähmt: {
      name: 'Paralyzed',
      summary: 'The creature can’t move or speak.',
      description: `- A paralyzed creature is incapacitated and can’t move or speak.
- It automatically fails Strength and Dexterity saving throws.
- Attack rolls against it have advantage.
- Any attack that hits it is a **critical hit** if the attacker is within 1.5 m.`,
    },
    Versteinert: {
      name: 'Petrified',
      summary: 'The creature and its gear are transformed into a solid, inanimate substance.',
      description: `- A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone). Its weight increases tenfold, and it ceases aging.
- It is incapacitated, can’t move or speak, and is unaware of its surroundings.
- Attack rolls against it have advantage.
- It automatically fails Strength and Dexterity saving throws.
- It has resistance to all damage.
- It is immune to poison and disease; a poison or disease already in its system is suspended, not neutralized.`,
    },
    Vergiftet: { name: 'Poisoned', summary: 'The creature has disadvantage on attack rolls and ability checks.', description: '- A poisoned creature has disadvantage on attack rolls and ability checks.' },
    Liegend: {
      name: 'Prone',
      summary: 'The creature is lying on the ground.',
      description: `- A prone creature’s only movement option is to crawl, unless it stands up and thereby ends the condition. Standing up costs half its speed.
- It has disadvantage on attack rolls.
- Attack rolls against it have advantage if the attacker is within 1.5 m; otherwise they have disadvantage.`,
    },
    Festgesetzt: {
      name: 'Restrained',
      summary: 'The creature is bound or held and can’t move.',
      description: `- A restrained creature’s speed becomes 0, and it can’t benefit from any bonus to its speed.
- Attack rolls against it have advantage, and its attack rolls have disadvantage.
- It has disadvantage on Dexterity saving throws.`,
    },
    Betäubt: {
      name: 'Stunned',
      summary: 'The creature is dazed and barely able to act.',
      description: `- A stunned creature is incapacitated, can’t move, and can speak only falteringly.
- It automatically fails Strength and Dexterity saving throws.
- Attack rolls against it have advantage.`,
    },
    Bewusstlos: {
      name: 'Unconscious',
      summary: 'The creature is out cold and unaware of its surroundings.',
      description: `- An unconscious creature is incapacitated, can’t move or speak, and is unaware of its surroundings.
- It drops whatever it’s holding and falls **prone**.
- It automatically fails Strength and Dexterity saving throws.
- Attack rolls against it have advantage.
- Any attack that hits it is a **critical hit** if the attacker is within 1.5 m.`,
    },
    'Vorteil und Nachteil': { name: 'Advantage and Disadvantage', summary: 'Roll two d20s and use the higher or lower result.' },
    Attributswürfe: { name: 'Ability Checks', summary: 'd20 + ability modifier (+ proficiency bonus) against a difficulty class.' },
    Rettungswürfe: { name: 'Saving Throws', summary: 'Resisting spells, traps, poisons and other dangers.' },
    'Ablauf des Kampfes': { name: 'Combat Step by Step', summary: 'Surprise, initiative and turns in rounds of about 6 seconds.' },
    Überraschung: { name: 'Surprise', summary: 'A surprised creature loses its first turn.' },
    'Aktionen im Kampf': { name: 'Actions in Combat', summary: 'Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object.' },
    Gelegenheitsangriff: { name: 'Opportunity Attacks', summary: 'A melee attack as a reaction when a hostile creature leaves your reach.' },
    Deckung: { name: 'Cover', summary: 'Obstacles protect against attacks and some saving throws.' },
    'Kampf mit zwei Waffen': { name: 'Two-Weapon Fighting', summary: 'Attack with a second light weapon as a bonus action.' },
    Ringen: { name: 'Grappling', summary: 'Seize and hold a creature with an attack.' },
    'Kreatur stoßen': { name: 'Shoving a Creature', summary: 'Knock a foe prone or push it away.' },
    'Kritische Treffer': { name: 'Critical Hits', summary: 'A natural 20 always hits and doubles the damage dice.' },
    'Auf 0 Trefferpunkte fallen': { name: 'Dropping to 0 Hit Points', summary: 'Unconsciousness, death saving throws and instant death.' },
    'Sicht und Licht': { name: 'Vision and Light', summary: 'Lightly and heavily obscured areas, darkvision and blindsight.' },
    Reisetempo: { name: 'Travel Pace', summary: 'Fast, normal and slow travel over land.' },
    Fallschaden: { name: 'Falling', summary: '1d6 bludgeoning damage per 3 m fallen, to a maximum of 20d6.' },
    Ersticken: { name: 'Suffocating', summary: 'How long a creature can hold its breath.' },
    Springen: { name: 'Jumping', summary: 'Long jump and high jump depending on Strength.' },
    'Kurze Rast': { name: 'Short Rest', summary: 'A break of at least one hour; spend Hit Dice.' },
    'Lange Rast': { name: 'Long Rest', summary: 'At least eight hours of rest; regain all hit points and half your Hit Dice.' },
    Konzentration: { name: 'Concentration', summary: 'Some spells last only as long as the caster concentrates.' },
    Rituale: { name: 'Rituals', summary: 'Cast spells with the ritual tag without expending a spell slot.' },
    'Zauber wirken': { name: 'Casting a Spell', summary: 'Spell slots, casting time, components and areas of effect.' },
  },
};

// ---------------------------------------------------------------- Nachtragen


/**
 * Englische Fassung der Grundausstattung nachtragen – nur für Einträge mit passendem deutschem Namen und noch leerer
 * englischer Fassung (eigene Übersetzungen bleiben unangetastet). Läuft beim Start und nach einem Gesamt-Import.
 */
export async function backfillEnglish() {
  let count = 0;
  for (const [kind, entries] of Object.entries(WIKI_EN)) {
    for (const [de, en] of Object.entries(entries)) {
      const r = await prisma.wikiEntry.updateMany({
        where: { kind, name: de, nameEn: '' },
        data: { nameEn: en.name, ...(en.summary !== undefined && { summaryEn: en.summary }), ...(en.description !== undefined && { descriptionEn: en.description }) },
      });
      count += r.count;
    }
  }
  for (const [de, en] of Object.entries(CATALOG_EN)) {
    const r = await prisma.catalogItem.updateMany({ where: { name: de, nameEn: '' }, data: { nameEn: en.name, descriptionEn: en.description } });
    count += r.count;
  }
  for (const [de, en] of Object.entries(SOURCES_EN)) {
    const r = await prisma.source.updateMany({ where: { name: de, nameEn: '' }, data: { nameEn: en.name, abbreviationEn: en.abbreviation } });
    count += r.count;
  }
  if (count) logger.info(`Englische Fassung für ${count} Einträge der Grundausstattung ergänzt.`);
  return count;
}
