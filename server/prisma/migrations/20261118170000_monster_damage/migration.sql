-- AlterTable
ALTER TABLE "Combatant" ADD COLUMN "damageDice" TEXT;
ALTER TABLE "Combatant" ADD COLUMN "damageType" TEXT;

-- AlterTable
ALTER TABLE "MonsterTemplate" ADD COLUMN "damageDice" TEXT;
ALTER TABLE "MonsterTemplate" ADD COLUMN "damageType" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BestiaryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ac" INTEGER,
    "hp" TEXT,
    "attack" TEXT NOT NULL DEFAULT '',
    "damageDice" TEXT,
    "damageType" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BestiaryEntry_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestiaryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BestiaryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BestiaryEntry" ("ac", "attack", "createdAt", "createdById", "description", "hp", "id", "name", "storyId", "updatedAt", "updatedById") SELECT "ac", "attack", "createdAt", "createdById", "description", CAST("hp" AS TEXT), "id", "name", "storyId", "updatedAt", "updatedById" FROM "BestiaryEntry";
DROP TABLE "BestiaryEntry";
ALTER TABLE "new_BestiaryEntry" RENAME TO "BestiaryEntry";
CREATE INDEX "BestiaryEntry_storyId_name_idx" ON "BestiaryEntry"("storyId", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

