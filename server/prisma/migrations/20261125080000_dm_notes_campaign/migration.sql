-- CreateTable
CREATE TABLE "DmNoteVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "noteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmNoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "DmNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DmNoteImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DmNoteImage_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DmNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'scene',
    "status" TEXT NOT NULL DEFAULT 'none',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "gameDate" TEXT NOT NULL DEFAULT '',
    "sessionDate" TEXT NOT NULL DEFAULT '',
    "xp" INTEGER,
    "tableRows" TEXT NOT NULL DEFAULT '[]',
    "monsters" TEXT NOT NULL DEFAULT '[]',
    "characterIds" TEXT NOT NULL DEFAULT '[]',
    "sharedAt" DATETIME,
    "sharedInfo" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "DmNote_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DmNote" ("body", "createdAt", "id", "position", "storyId", "title", "updatedAt", "updatedBy") SELECT "body", "createdAt", "id", "position", "storyId", "title", "updatedAt", "updatedBy" FROM "DmNote";
DROP TABLE "DmNote";
ALTER TABLE "new_DmNote" RENAME TO "DmNote";
CREATE INDEX "DmNote_storyId_position_idx" ON "DmNote"("storyId", "position");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DmNoteVersion_noteId_createdAt_idx" ON "DmNoteVersion"("noteId", "createdAt");

-- CreateIndex
CREATE INDEX "DmNoteImage_storyId_idx" ON "DmNoteImage"("storyId");

