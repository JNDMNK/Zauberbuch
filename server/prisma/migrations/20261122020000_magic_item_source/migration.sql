-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MagicItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "attunement" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MagicItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MagicItem" ("attunement", "createdAt", "description", "id", "name", "updatedAt", "value", "weight") SELECT "attunement", "createdAt", "description", "id", "name", "updatedAt", "value", "weight" FROM "MagicItem";
DROP TABLE "MagicItem";
ALTER TABLE "new_MagicItem" RENAME TO "MagicItem";
CREATE INDEX "MagicItem_name_idx" ON "MagicItem"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Mitgelieferte Beispielzauber hatten die Quelle „SRD“, die nicht in der Quellenliste steht:
-- sie stammen aus dem Spielerhandbuch und werden damit verknüpft (nur wenn diese Quelle existiert)
UPDATE "Spell" SET "source" = (SELECT "name" FROM "Source" WHERE "id" = 'src_phb')
WHERE "source" = 'SRD' AND EXISTS (SELECT 1 FROM "Source" WHERE "id" = 'src_phb');
