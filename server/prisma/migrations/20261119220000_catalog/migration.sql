-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT,
    "baseId" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "ac" TEXT NOT NULL DEFAULT '',
    "damageDice" TEXT,
    "damageType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CatalogItem_storyId_category_idx" ON "CatalogItem"("storyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_storyId_baseId_key" ON "CatalogItem"("storyId", "baseId");

