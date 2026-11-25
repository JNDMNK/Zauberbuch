-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "UserAvatar" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

