-- CreateTable
CREATE TABLE "CharacterNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithDm" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CharacterNote_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CharacterNote_characterId_idx" ON "CharacterNote"("characterId");

