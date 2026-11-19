-- Bestehende Gegenstände waren bisher alle einstimmbar: Haken für sie gesetzt lassen, neue starten ohne
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MagicItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "attunement" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MagicItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MagicItem" ("createdAt", "description", "id", "name", "storyId", "updatedAt", "value", "weight", "attunement") SELECT "createdAt", "description", "id", "name", "storyId", "updatedAt", "value", "weight", 1 FROM "MagicItem";
DROP TABLE "MagicItem";
ALTER TABLE "new_MagicItem" RENAME TO "MagicItem";
CREATE INDEX "MagicItem_storyId_name_idx" ON "MagicItem"("storyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

