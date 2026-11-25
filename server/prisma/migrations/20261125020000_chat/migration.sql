-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "characterId" TEXT,
    "characterName" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL DEFAULT '',
    "dice" TEXT NOT NULL DEFAULT '',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatMessage_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChatMessage_storyId_senderId_recipientId_createdAt_idx" ON "ChatMessage"("storyId", "senderId", "recipientId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_recipientId_readAt_idx" ON "ChatMessage"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "ChatMessage_updatedAt_idx" ON "ChatMessage"("updatedAt");

