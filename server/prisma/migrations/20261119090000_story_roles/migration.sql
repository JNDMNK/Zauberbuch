-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StoryMember" (
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("storyId", "userId"),
    CONSTRAINT "StoryMember_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StoryMember" ("createdAt", "storyId", "userId") SELECT "createdAt", "storyId", "userId" FROM "StoryMember";
DROP TABLE "StoryMember";
ALTER TABLE "new_StoryMember" RENAME TO "StoryMember";
CREATE INDEX "StoryMember_userId_idx" ON "StoryMember"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "language" TEXT NOT NULL DEFAULT 'de',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "canEditSpells" BOOLEAN NOT NULL DEFAULT false,
    "combatAsPlayer" BOOLEAN NOT NULL DEFAULT false,
    "activeStoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_activeStoryId_fkey" FOREIGN KEY ("activeStoryId") REFERENCES "Story" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("canEditSpells", "combatAsPlayer", "createdAt", "email", "id", "language", "passwordHash", "role", "tokenVersion", "updatedAt", "username") SELECT "canEditSpells", "combatAsPlayer", "createdAt", "email", "id", "language", "passwordHash", "role", "tokenVersion", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Datenübernahme: Rechte für Infotafel und Kampf hängen jetzt an der Rolle pro Geschichte.
-- Damit niemand den Zugriff verliert, werden bisherige Dungeon Master (Server-Rolle, jetzt „Moderator“)
-- in allen vorhandenen Geschichten als DM eingetragen. Bisherige Mitspieler bleiben Spieler.
UPDATE "StoryMember" SET "role" = 'dm'
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'dungeonmaster');
INSERT OR IGNORE INTO "StoryMember" ("storyId", "userId", "role", "createdAt")
SELECT "Story"."id", "User"."id", 'dm', CURRENT_TIMESTAMP
FROM "Story", "User"
WHERE "User"."role" = 'dungeonmaster';
