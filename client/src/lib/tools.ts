/** Ältere Werkzeugnamen (Standardliste der Geschichten) → Name in der Gegenstands-Datenbank */
export const TOOL_ALIASES: Record<string, string> = {
  Alchemistenlabor: 'Alchemistenausrüstung',
  Brauereivorräte: 'Brauerausrüstung',
  Glasbläserwerkzeuge: 'Glasbläserwerkzeug',
  Holzschnitzwerkzeuge: 'Holzschnitzerwerkzeug',
  Juwelierwerkzeuge: 'Juwelierswerkzeug',
  Kalligraphiewerkzeuge: 'Kalligrafieausrüstung',
  Ledererwerkzeuge: 'Lederverarbeitungswerkzeug',
  Malutensilien: 'Malerausrüstung',
  Maurerwerkzeuge: 'Steinmetzwerkzeug',
  Schmiedewerkzeuge: 'Schmiedewerkzeug',
  Schreinerwerkzeuge: 'Zimmermannswerkzeug',
  Schusterwerkzeuge: 'Schusterwerkzeug',
  Töpferwerkzeuge: 'Töpferwerkzeug',
  Tüftlerwerkzeuge: 'Kesselflickerwerkzeug',
  Weberwerkzeuge: 'Weberwerkzeug',
  'Satz Spielkarten': 'Kartenspiel',
  'Satz Würfel': 'Würfelspiel',
  Navigationswerkzeuge: 'Navigationswerkzeug',
};

/** Vergleichsschlüssel eines Werkzeugnamens (berücksichtigt ältere Namen) */
export const toolKey = (name: string) => (TOOL_ALIASES[name] ?? name).toLocaleLowerCase('de');
