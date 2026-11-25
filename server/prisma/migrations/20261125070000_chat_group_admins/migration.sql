-- AlterTable
ALTER TABLE "ChatGroup" ADD COLUMN "imageUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "ChatGroupImage" (
    "groupId" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatGroupImage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("groupId", "userId"),
    CONSTRAINT "ChatGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatGroupMember" ("groupId", "joinedAt", "lastReadAt", "userId") SELECT "groupId", "joinedAt", "lastReadAt", "userId" FROM "ChatGroupMember";
DROP TABLE "ChatGroupMember";
ALTER TABLE "new_ChatGroupMember" RENAME TO "ChatGroupMember";
CREATE INDEX "ChatGroupMember_userId_idx" ON "ChatGroupMember"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

