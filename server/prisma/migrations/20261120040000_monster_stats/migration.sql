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
    "stats" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BestiaryEntry_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestiaryEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BestiaryEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BestiaryEntry" ("ac", "attack", "createdAt", "createdById", "damageDice", "damageType", "description", "hp", "id", "name", "storyId", "updatedAt", "updatedById") SELECT "ac", "attack", "createdAt", "createdById", "damageDice", "damageType", "description", "hp", "id", "name", "storyId", "updatedAt", "updatedById" FROM "BestiaryEntry";
DROP TABLE "BestiaryEntry";
ALTER TABLE "new_BestiaryEntry" RENAME TO "BestiaryEntry";
CREATE INDEX "BestiaryEntry_storyId_name_idx" ON "BestiaryEntry"("storyId", "name");
CREATE TABLE "new_MonsterTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ac" INTEGER,
    "hp" INTEGER NOT NULL DEFAULT 0,
    "attack" TEXT NOT NULL DEFAULT '',
    "damageDice" TEXT,
    "damageType" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "stats" TEXT NOT NULL DEFAULT '{}',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonsterTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MonsterTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MonsterTemplate" ("ac", "attack", "createdAt", "createdById", "damageDice", "damageType", "description", "hp", "id", "name", "updatedAt", "updatedById") SELECT "ac", "attack", "createdAt", "createdById", "damageDice", "damageType", "description", "hp", "id", "name", "updatedAt", "updatedById" FROM "MonsterTemplate";
DROP TABLE "MonsterTemplate";
ALTER TABLE "new_MonsterTemplate" RENAME TO "MonsterTemplate";
CREATE INDEX "MonsterTemplate_name_idx" ON "MonsterTemplate"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

