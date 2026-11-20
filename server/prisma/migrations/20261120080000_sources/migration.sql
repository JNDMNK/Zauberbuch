-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT,
    "baseId" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "ac" TEXT NOT NULL DEFAULT '',
    "strength" INTEGER,
    "damageDice" TEXT,
    "damageType" TEXT,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CatalogItem" ("ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "storyId", "strength", "updatedAt", "value", "weight") SELECT "ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "storyId", "strength", "updatedAt", "value", "weight" FROM "CatalogItem";
DROP TABLE "CatalogItem";
ALTER TABLE "new_CatalogItem" RENAME TO "CatalogItem";
CREATE INDEX "CatalogItem_storyId_category_idx" ON "CatalogItem"("storyId", "category");
CREATE UNIQUE INDEX "CatalogItem_storyId_baseId_key" ON "CatalogItem"("storyId", "baseId");
CREATE TABLE "new_WikiEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '{}',
    "sourceId" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WikiEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WikiEntry" ("createdAt", "data", "description", "id", "kind", "name", "summary", "updatedAt", "updatedBy") SELECT "createdAt", "data", "description", "id", "kind", "name", "summary", "updatedAt", "updatedBy" FROM "WikiEntry";
DROP TABLE "WikiEntry";
ALTER TABLE "new_WikiEntry" RENAME TO "WikiEntry";
CREATE INDEX "WikiEntry_kind_name_idx" ON "WikiEntry"("kind", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");


-- Grundausstattung der Quellen
INSERT INTO "Source" ("id", "name", "abbreviation", "createdAt", "updatedAt") VALUES
  ('src_phb', 'Spielerhandbuch', 'SHB', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('src_tce', 'Tashas Kessel der Schöpfung', 'TKS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('src_xge', 'Xanathars Ratgeber für alles', 'XRA', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Die mitgelieferten SRD-Inhalte (Wiki und Standard-Gegenstände) stammen aus dem Spielerhandbuch
UPDATE "WikiEntry" SET "sourceId" = 'src_phb' WHERE "sourceId" IS NULL AND "updatedBy" IS NULL;
UPDATE "CatalogItem" SET "sourceId" = 'src_phb' WHERE "sourceId" IS NULL AND "storyId" IS NULL AND "name" IN ('Knüppel', 'Dolch', 'Zweihandknüppel', 'Beil', 'Wurfspeer', 'Leichter Hammer', 'Streitkolben', 'Kampfstab', 'Sichel', 'Speer', 'Leichte Armbrust', 'Wurfpfeil', 'Kurzbogen', 'Schleuder', 'Streitaxt', 'Flegel', 'Glefe', 'Zweihandaxt', 'Zweihandschwert', 'Hellebarde', 'Lanze', 'Langschwert', 'Zweihandhammer', 'Morgenstern', 'Pike', 'Rapier', 'Krummsäbel', 'Kurzschwert', 'Dreizack', 'Kriegspicke', 'Kriegshammer', 'Peitsche', 'Blasrohr', 'Handarmbrust', 'Schwere Armbrust', 'Langbogen', 'Netz', 'Gepolsterte Rüstung', 'Lederrüstung', 'Beschlagene Lederrüstung', 'Fellrüstung', 'Kettenhemd', 'Schuppenpanzer', 'Brustplatte', 'Halbplattenpanzer', 'Ringpanzer', 'Kettenpanzer', 'Schienenpanzer', 'Plattenpanzer', 'Schild', 'Heiltrank', 'Großer Heiltrank', 'Gegengift (Phiole)', 'Alchemistenfeuer (Flasche)', 'Säure (Phiole)', 'Weihwasser (Flasche)', 'Öl (Flasche)', 'Krähenfüße (Beutel mit 20)', 'Kugellager (Beutel mit 1000)', 'Pfeile (20)', 'Bolzen (20)', 'Köcher', 'Rucksack', 'Schlafsack', 'Decke', 'Fackel', 'Laterne (Kapuze)', 'Kerze', 'Zunderkästchen', 'Rationen (1 Tag)', 'Wasserschlauch', 'Seil (Hanf, 15 m)', 'Seil (Seide, 15 m)', 'Kletterhaken', 'Enterhaken', 'Brechstange', 'Hammer', 'Schaufel', 'Spiegel (Stahl)', 'Heilerausrüstung', 'Kletterausrüstung', 'Kreide (1 Stück)', 'Tinte und Feder', 'Pergament (1 Blatt)', 'Zelt (2 Personen)');
