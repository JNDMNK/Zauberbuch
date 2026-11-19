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
    "damageDice" TEXT,
    "damageType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CatalogItem" ("ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "storyId", "updatedAt", "weight") SELECT "ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "storyId", "updatedAt", "weight" FROM "CatalogItem";
DROP TABLE "CatalogItem";
ALTER TABLE "new_CatalogItem" RENAME TO "CatalogItem";
CREATE INDEX "CatalogItem_storyId_category_idx" ON "CatalogItem"("storyId", "category");
CREATE UNIQUE INDEX "CatalogItem_storyId_baseId_key" ON "CatalogItem"("storyId", "baseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Werte (SRD-Preise) für die mitgelieferte Grundausstattung nachtragen, sofern noch leer
UPDATE "CatalogItem" SET "value" = '1 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Knüppel';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Dolch';
UPDATE "CatalogItem" SET "value" = '2 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zweihandknüppel';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Beil';
UPDATE "CatalogItem" SET "value" = '5 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Wurfspeer';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Leichter Hammer';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Streitkolben';
UPDATE "CatalogItem" SET "value" = '2 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kampfstab';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Sichel';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Speer';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Leichte Armbrust';
UPDATE "CatalogItem" SET "value" = '5 KM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Wurfpfeil';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kurzbogen';
UPDATE "CatalogItem" SET "value" = '1 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schleuder';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Streitaxt';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Flegel';
UPDATE "CatalogItem" SET "value" = '20 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Glefe';
UPDATE "CatalogItem" SET "value" = '30 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zweihandaxt';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zweihandschwert';
UPDATE "CatalogItem" SET "value" = '20 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Hellebarde';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Lanze';
UPDATE "CatalogItem" SET "value" = '15 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Langschwert';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zweihandhammer';
UPDATE "CatalogItem" SET "value" = '15 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Morgenstern';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Pike';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Rapier';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Krummsäbel';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kurzschwert';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Dreizack';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kriegspicke';
UPDATE "CatalogItem" SET "value" = '15 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kriegshammer';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Peitsche';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Blasrohr';
UPDATE "CatalogItem" SET "value" = '75 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Handarmbrust';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schwere Armbrust';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Langbogen';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Netz';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Gepolsterte Rüstung';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Lederrüstung';
UPDATE "CatalogItem" SET "value" = '45 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Beschlagene Lederrüstung';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Fellrüstung';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kettenhemd';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schuppenpanzer';
UPDATE "CatalogItem" SET "value" = '400 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Brustplatte';
UPDATE "CatalogItem" SET "value" = '750 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Halbplattenpanzer';
UPDATE "CatalogItem" SET "value" = '30 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Ringpanzer';
UPDATE "CatalogItem" SET "value" = '75 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kettenpanzer';
UPDATE "CatalogItem" SET "value" = '200 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schienenpanzer';
UPDATE "CatalogItem" SET "value" = '1.500 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Plattenpanzer';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schild';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Heiltrank';
UPDATE "CatalogItem" SET "value" = '100 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Großer Heiltrank';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Gegengift (Phiole)';
UPDATE "CatalogItem" SET "value" = '50 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Alchemistenfeuer (Flasche)';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Säure (Phiole)';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Weihwasser (Flasche)';
UPDATE "CatalogItem" SET "value" = '1 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Öl (Flasche)';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Krähenfüße (Beutel mit 20)';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kugellager (Beutel mit 1000)';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Pfeile (20)';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Bolzen (20)';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Köcher';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Rucksack';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schlafsack';
UPDATE "CatalogItem" SET "value" = '5 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Decke';
UPDATE "CatalogItem" SET "value" = '1 KM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Fackel';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Laterne (Kapuze)';
UPDATE "CatalogItem" SET "value" = '1 KM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kerze';
UPDATE "CatalogItem" SET "value" = '5 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zunderkästchen';
UPDATE "CatalogItem" SET "value" = '5 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Rationen (1 Tag)';
UPDATE "CatalogItem" SET "value" = '2 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Wasserschlauch';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Seil (Hanf, 15 m)';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Seil (Seide, 15 m)';
UPDATE "CatalogItem" SET "value" = '5 KM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kletterhaken';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Enterhaken';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Brechstange';
UPDATE "CatalogItem" SET "value" = '1 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Hammer';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Schaufel';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Spiegel (Stahl)';
UPDATE "CatalogItem" SET "value" = '5 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Heilerausrüstung';
UPDATE "CatalogItem" SET "value" = '25 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kletterausrüstung';
UPDATE "CatalogItem" SET "value" = '1 KM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Kreide (1 Stück)';
UPDATE "CatalogItem" SET "value" = '10 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Tinte und Feder';
UPDATE "CatalogItem" SET "value" = '1 SM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Pergament (1 Blatt)';
UPDATE "CatalogItem" SET "value" = '2 GM' WHERE "storyId" IS NULL AND "value" = '' AND "name" = 'Zelt (2 Personen)';

-- Bereits angepasste Einträge in Geschichten übernehmen den Wert ihres Standard-Eintrags
UPDATE "CatalogItem" SET "value" = (SELECT b."value" FROM "CatalogItem" b WHERE b."id" = "CatalogItem"."baseId") WHERE "baseId" IS NOT NULL AND "value" = '';
