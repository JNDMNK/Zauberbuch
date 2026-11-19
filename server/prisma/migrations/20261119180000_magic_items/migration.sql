-- CreateTable
CREATE TABLE "MagicItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MagicItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MagicItemHolder" (
    "itemId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("itemId", "characterId"),
    CONSTRAINT "MagicItemHolder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MagicItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MagicItemHolder_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MagicItem_storyId_name_idx" ON "MagicItem"("storyId", "name");

-- CreateIndex
CREATE INDEX "MagicItemHolder_characterId_idx" ON "MagicItemHolder"("characterId");

