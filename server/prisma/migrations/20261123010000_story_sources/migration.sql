-- Erlaubte Quellen einer Geschichte (JSON-Liste von Quellen-IDs und „homebrew“); leer = alle Quellen
ALTER TABLE "Story" ADD COLUMN "sources" TEXT NOT NULL DEFAULT '';
