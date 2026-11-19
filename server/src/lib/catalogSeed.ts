/**
 * Grundausstattung der Standard-Gegenstandsdatenbank (Werte nach den freien 5e-SRD-Regeln, deutsche Namen,
 * Beschreibungen selbst formuliert). Wird beim ersten Start angelegt, wenn die Standard-Datenbank leer ist.
 */
export interface CatalogSeedItem {
  category: 'armor' | 'weapon' | 'gear';
  name: string;
  description: string;
  weight: number;
  ac: string;
  damageDice: string | null;
  damageType: string | null;
}

export const CATALOG_SEED: CatalogSeedItem[] = [
  {
    "category": "weapon",
    "name": "Knüppel",
    "damageDice": "1d4",
    "damageType": "bludgeoning",
    "weight": 2,
    "description": "Einfache Nahkampfwaffe. Leicht.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Dolch",
    "damageDice": "1d4",
    "damageType": "piercing",
    "weight": 1,
    "description": "Einfache Nahkampfwaffe. Finesse, leicht, Wurfwaffe (Reichweite 6/18 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Zweihandknüppel",
    "damageDice": "1d8",
    "damageType": "bludgeoning",
    "weight": 10,
    "description": "Einfache Nahkampfwaffe. Zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Beil",
    "damageDice": "1d6",
    "damageType": "slashing",
    "weight": 2,
    "description": "Einfache Nahkampfwaffe. Leicht, Wurfwaffe (Reichweite 6/18 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Wurfspeer",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 2,
    "description": "Einfache Nahkampfwaffe. Wurfwaffe (Reichweite 9/36 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Leichter Hammer",
    "damageDice": "1d4",
    "damageType": "bludgeoning",
    "weight": 2,
    "description": "Einfache Nahkampfwaffe. Leicht, Wurfwaffe (Reichweite 6/18 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Streitkolben",
    "damageDice": "1d6",
    "damageType": "bludgeoning",
    "weight": 4,
    "description": "Einfache Nahkampfwaffe.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Kampfstab",
    "damageDice": "1d6",
    "damageType": "bludgeoning",
    "weight": 4,
    "description": "Einfache Nahkampfwaffe. Vielseitig (1W8).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Sichel",
    "damageDice": "1d4",
    "damageType": "slashing",
    "weight": 2,
    "description": "Einfache Nahkampfwaffe. Leicht.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Speer",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 3,
    "description": "Einfache Nahkampfwaffe. Wurfwaffe (Reichweite 6/18 m), vielseitig (1W8).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Leichte Armbrust",
    "damageDice": "1d8",
    "damageType": "piercing",
    "weight": 5,
    "description": "Einfache Fernkampfwaffe. Munition (Reichweite 24/96 m), Laden, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Wurfpfeil",
    "damageDice": "1d4",
    "damageType": "piercing",
    "weight": 0.25,
    "description": "Einfache Fernkampfwaffe. Finesse, Wurfwaffe (Reichweite 6/18 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Kurzbogen",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 2,
    "description": "Einfache Fernkampfwaffe. Munition (Reichweite 24/96 m), zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Schleuder",
    "damageDice": "1d4",
    "damageType": "bludgeoning",
    "weight": 0,
    "description": "Einfache Fernkampfwaffe. Munition (Reichweite 9/36 m).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Streitaxt",
    "damageDice": "1d8",
    "damageType": "slashing",
    "weight": 4,
    "description": "Kriegswaffe (Nahkampf). Vielseitig (1W10).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Flegel",
    "damageDice": "1d8",
    "damageType": "bludgeoning",
    "weight": 2,
    "description": "Kriegswaffe (Nahkampf).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Glefe",
    "damageDice": "1d10",
    "damageType": "slashing",
    "weight": 6,
    "description": "Kriegswaffe (Nahkampf). Schwer, Reichweite, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Zweihandaxt",
    "damageDice": "1d12",
    "damageType": "slashing",
    "weight": 7,
    "description": "Kriegswaffe (Nahkampf). Schwer, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Zweihandschwert",
    "damageDice": "2d6",
    "damageType": "slashing",
    "weight": 6,
    "description": "Kriegswaffe (Nahkampf). Schwer, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Hellebarde",
    "damageDice": "1d10",
    "damageType": "slashing",
    "weight": 6,
    "description": "Kriegswaffe (Nahkampf). Schwer, Reichweite, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Lanze",
    "damageDice": "1d12",
    "damageType": "piercing",
    "weight": 6,
    "description": "Kriegswaffe (Nahkampf). Reichweite, besonders (Nachteil auf 1,5 m; beritten einhändig).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Langschwert",
    "damageDice": "1d8",
    "damageType": "slashing",
    "weight": 3,
    "description": "Kriegswaffe (Nahkampf). Vielseitig (1W10).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Zweihandhammer",
    "damageDice": "2d6",
    "damageType": "bludgeoning",
    "weight": 10,
    "description": "Kriegswaffe (Nahkampf). Schwer, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Morgenstern",
    "damageDice": "1d8",
    "damageType": "piercing",
    "weight": 4,
    "description": "Kriegswaffe (Nahkampf).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Pike",
    "damageDice": "1d10",
    "damageType": "piercing",
    "weight": 18,
    "description": "Kriegswaffe (Nahkampf). Schwer, Reichweite, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Rapier",
    "damageDice": "1d8",
    "damageType": "piercing",
    "weight": 2,
    "description": "Kriegswaffe (Nahkampf). Finesse.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Krummsäbel",
    "damageDice": "1d6",
    "damageType": "slashing",
    "weight": 3,
    "description": "Kriegswaffe (Nahkampf). Finesse, leicht.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Kurzschwert",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 2,
    "description": "Kriegswaffe (Nahkampf). Finesse, leicht.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Dreizack",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 4,
    "description": "Kriegswaffe (Nahkampf). Wurfwaffe (Reichweite 6/18 m), vielseitig (1W8).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Kriegspicke",
    "damageDice": "1d8",
    "damageType": "piercing",
    "weight": 2,
    "description": "Kriegswaffe (Nahkampf).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Kriegshammer",
    "damageDice": "1d8",
    "damageType": "bludgeoning",
    "weight": 2,
    "description": "Kriegswaffe (Nahkampf). Vielseitig (1W10).",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Peitsche",
    "damageDice": "1d4",
    "damageType": "slashing",
    "weight": 3,
    "description": "Kriegswaffe (Nahkampf). Finesse, Reichweite.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Blasrohr",
    "damageDice": "1",
    "damageType": "piercing",
    "weight": 1,
    "description": "Kriegswaffe (Fernkampf). Munition (Reichweite 7,5/30 m), Laden.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Handarmbrust",
    "damageDice": "1d6",
    "damageType": "piercing",
    "weight": 3,
    "description": "Kriegswaffe (Fernkampf). Munition (Reichweite 9/36 m), leicht, Laden.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Schwere Armbrust",
    "damageDice": "1d10",
    "damageType": "piercing",
    "weight": 18,
    "description": "Kriegswaffe (Fernkampf). Munition (Reichweite 30/120 m), schwer, Laden, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Langbogen",
    "damageDice": "1d8",
    "damageType": "piercing",
    "weight": 2,
    "description": "Kriegswaffe (Fernkampf). Munition (Reichweite 45/180 m), schwer, zweihändig.",
    "ac": ""
  },
  {
    "category": "weapon",
    "name": "Netz",
    "damageDice": null,
    "damageType": null,
    "weight": 3,
    "description": "Kriegswaffe (Fernkampf). Wurfwaffe (Reichweite 1,5/4,5 m). Ein getroffenes Wesen bis Größe groß ist festgesetzt (Befreien: SG-10-Stärkewurf oder 5 Hiebschaden gegen das Netz).",
    "ac": ""
  },
  {
    "category": "armor",
    "name": "Gepolsterte Rüstung",
    "ac": "11 + GES",
    "weight": 8,
    "description": "Leichte Rüstung. Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Lederrüstung",
    "ac": "11 + GES",
    "weight": 10,
    "description": "Leichte Rüstung aus gehärtetem Leder.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Beschlagene Lederrüstung",
    "ac": "12 + GES",
    "weight": 13,
    "description": "Leichte Rüstung, mit Nieten oder Dornen verstärkt.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Fellrüstung",
    "ac": "12 + GES (max. 2)",
    "weight": 12,
    "description": "Mittelschwere Rüstung aus dicken Fellen.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Kettenhemd",
    "ac": "13 + GES (max. 2)",
    "weight": 20,
    "description": "Mittelschwere Rüstung aus verflochtenen Metallringen, unter der Kleidung getragen.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Schuppenpanzer",
    "ac": "14 + GES (max. 2)",
    "weight": 45,
    "description": "Mittelschwere Rüstung. Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Brustplatte",
    "ac": "14 + GES (max. 2)",
    "weight": 20,
    "description": "Mittelschwere Rüstung, schützt Brust und Rücken.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Halbplattenpanzer",
    "ac": "15 + GES (max. 2)",
    "weight": 40,
    "description": "Mittelschwere Rüstung. Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Ringpanzer",
    "ac": "14",
    "weight": 40,
    "description": "Schwere Rüstung. Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Kettenpanzer",
    "ac": "16",
    "weight": 55,
    "description": "Schwere Rüstung. Stärke 13 erforderlich, Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Schienenpanzer",
    "ac": "17",
    "weight": 60,
    "description": "Schwere Rüstung. Stärke 15 erforderlich, Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Plattenpanzer",
    "ac": "18",
    "weight": 65,
    "description": "Schwere Rüstung. Stärke 15 erforderlich, Nachteil auf Geschicklichkeit (Heimlichkeit).",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "armor",
    "name": "Schild",
    "ac": "+2",
    "weight": 6,
    "description": "Wird in einer Hand getragen und erhöht die Rüstungsklasse um 2.",
    "damageDice": null,
    "damageType": null
  },
  {
    "category": "gear",
    "name": "Heiltrank",
    "damageDice": "2d4+2",
    "damageType": "healing",
    "weight": 0.5,
    "description": "Wer den Trank trinkt, erhält Trefferpunkte zurück. Eine Aktion zum Trinken oder Verabreichen.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Großer Heiltrank",
    "damageDice": "4d4+4",
    "damageType": "healing",
    "weight": 0.5,
    "description": "Stärkerer Heiltrank.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Gegengift (Phiole)",
    "damageDice": null,
    "damageType": null,
    "weight": 0,
    "description": "Vorteil auf Rettungswürfe gegen Gift für 1 Stunde.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Alchemistenfeuer (Flasche)",
    "damageDice": "1d4",
    "damageType": "fire",
    "weight": 1,
    "description": "Als improvisierte Wurfwaffe (Reichweite 6 m); das Ziel brennt, bis es die Flammen löscht (SG 10 Geschicklichkeit).",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Säure (Phiole)",
    "damageDice": "2d6",
    "damageType": "acid",
    "weight": 1,
    "description": "Als improvisierte Wurfwaffe (Reichweite 6 m) gegen ein Wesen oder Objekt.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Weihwasser (Flasche)",
    "damageDice": "2d6",
    "damageType": "radiant",
    "weight": 1,
    "description": "Als improvisierte Wurfwaffe (Reichweite 6 m); wirkt nur gegen Unholde und Untote.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Öl (Flasche)",
    "damageDice": "5",
    "damageType": "fire",
    "weight": 1,
    "description": "Kann ausgegossen und angezündet werden; brennt 2 Runden.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Krähenfüße (Beutel mit 20)",
    "damageDice": "1",
    "damageType": "piercing",
    "weight": 2,
    "description": "Bedeckt eine Fläche von 1,5 m × 1,5 m; wer sie betritt, macht einen SG-15-Geschicklichkeitsrettungswurf.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Kugellager (Beutel mit 1000)",
    "damageDice": null,
    "damageType": null,
    "weight": 2,
    "description": "Bedeckt eine Fläche von 3 m × 3 m; wer sie betritt, kann stürzen (SG 10 Geschicklichkeit).",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Pfeile (20)",
    "damageDice": null,
    "damageType": null,
    "weight": 1,
    "description": "Munition für Bögen.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Bolzen (20)",
    "damageDice": null,
    "damageType": null,
    "weight": 1.5,
    "description": "Munition für Armbrüste.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Köcher",
    "damageDice": null,
    "damageType": null,
    "weight": 1,
    "description": "Fasst bis zu 20 Pfeile.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Rucksack",
    "damageDice": null,
    "damageType": null,
    "weight": 5,
    "description": "Fasst etwa 30 Pfund Ausrüstung.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Schlafsack",
    "damageDice": null,
    "damageType": null,
    "weight": 7,
    "description": "Für die Nacht unter freiem Himmel.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Decke",
    "damageDice": null,
    "damageType": null,
    "weight": 3,
    "description": "Wärmende Wolldecke.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Fackel",
    "damageDice": null,
    "damageType": null,
    "weight": 1,
    "description": "Brennt 1 Stunde; helles Licht im Umkreis von 6 m, dämmriges Licht weitere 6 m.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Laterne (Kapuze)",
    "damageDice": null,
    "damageType": null,
    "weight": 2,
    "description": "Brennt 6 Stunden mit einer Flasche Öl; helles Licht 9 m, dämmriges Licht weitere 9 m.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Kerze",
    "damageDice": null,
    "damageType": null,
    "weight": 0,
    "description": "Brennt 1 Stunde; helles Licht 1,5 m.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Zunderkästchen",
    "damageDice": null,
    "damageType": null,
    "weight": 1,
    "description": "Feuerstein, Stahl und Zunder zum Entzünden eines Feuers.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Rationen (1 Tag)",
    "damageDice": null,
    "damageType": null,
    "weight": 2,
    "description": "Haltbare Reiseverpflegung.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Wasserschlauch",
    "damageDice": null,
    "damageType": null,
    "weight": 5,
    "description": "Fasst etwa 2 Liter (voll).",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Seil (Hanf, 15 m)",
    "damageDice": null,
    "damageType": null,
    "weight": 10,
    "description": "Hält bis zu 2 Trefferpunkte Schaden aus; zerreißen mit SG 17 Stärke.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Seil (Seide, 15 m)",
    "damageDice": null,
    "damageType": null,
    "weight": 5,
    "description": "Leichter als Hanfseil.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Kletterhaken",
    "damageDice": null,
    "damageType": null,
    "weight": 0.25,
    "description": "Zum Sichern beim Klettern.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Enterhaken",
    "damageDice": null,
    "damageType": null,
    "weight": 4,
    "description": "Zum Werfen und Festhaken.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Brechstange",
    "damageDice": null,
    "damageType": null,
    "weight": 5,
    "description": "Vorteil auf Stärkewürfe, bei denen die Hebelwirkung hilft.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Hammer",
    "damageDice": null,
    "damageType": null,
    "weight": 3,
    "description": "Einfacher Werkzeughammer.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Schaufel",
    "damageDice": null,
    "damageType": null,
    "weight": 5,
    "description": "Zum Graben.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Spiegel (Stahl)",
    "damageDice": null,
    "damageType": null,
    "weight": 0.5,
    "description": "Kleiner Handspiegel.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Heilerausrüstung",
    "damageDice": null,
    "damageType": null,
    "weight": 3,
    "description": "10 Anwendungen: ein Wesen mit 0 TP ohne Weisheitswurf (Heilkunde) stabilisieren.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Kletterausrüstung",
    "damageDice": null,
    "damageType": null,
    "weight": 12,
    "description": "Haken, Stiefelspitzen, Handschuhe und Gurt.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Kreide (1 Stück)",
    "damageDice": null,
    "damageType": null,
    "weight": 0,
    "description": "Zum Markieren von Wegen.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Tinte und Feder",
    "damageDice": null,
    "damageType": null,
    "weight": 0,
    "description": "Tintenfass (30 ml) und Schreibfeder.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Pergament (1 Blatt)",
    "damageDice": null,
    "damageType": null,
    "weight": 0,
    "description": "Zum Schreiben und Zeichnen.",
    "ac": ""
  },
  {
    "category": "gear",
    "name": "Zelt (2 Personen)",
    "damageDice": null,
    "damageType": null,
    "weight": 20,
    "description": "Einfaches Zelt aus Leinwand.",
    "ac": ""
  }
];
