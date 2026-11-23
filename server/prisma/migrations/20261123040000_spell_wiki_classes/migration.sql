-- Zuordnung von Zaubern zu eigenen Wiki-Klassen (JSON-Liste von Wiki-Eintrags-IDs)
ALTER TABLE "Spell" ADD COLUMN "wikiClasses" TEXT NOT NULL DEFAULT '';
