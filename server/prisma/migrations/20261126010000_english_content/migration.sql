-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT,
    "baseId" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "ac" TEXT NOT NULL DEFAULT '',
    "strength" INTEGER,
    "damageDice" TEXT,
    "damageType" TEXT,
    "toolType" TEXT,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CatalogItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "CatalogItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CatalogItem" ("ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "sourceId", "storyId", "strength", "toolType", "updatedAt", "value", "weight") SELECT "ac", "baseId", "category", "createdAt", "damageDice", "damageType", "description", "hidden", "id", "name", "sourceId", "storyId", "strength", "toolType", "updatedAt", "value", "weight" FROM "CatalogItem";
DROP TABLE "CatalogItem";
ALTER TABLE "new_CatalogItem" RENAME TO "CatalogItem";
CREATE INDEX "CatalogItem_storyId_category_idx" ON "CatalogItem"("storyId", "category");
CREATE UNIQUE INDEX "CatalogItem_storyId_baseId_key" ON "CatalogItem"("storyId", "baseId");
CREATE TABLE "new_MagicItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" REAL NOT NULL DEFAULT 0,
    "value" TEXT NOT NULL DEFAULT '',
    "attunement" BOOLEAN NOT NULL DEFAULT false,
    "sourceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "MagicItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MagicItem" ("attunement", "createdAt", "description", "id", "name", "sourceId", "updatedAt", "value", "weight") SELECT "attunement", "createdAt", "description", "id", "name", "sourceId", "updatedAt", "value", "weight" FROM "MagicItem";
DROP TABLE "MagicItem";
ALTER TABLE "new_MagicItem" RENAME TO "MagicItem";
CREATE INDEX "MagicItem_name_idx" ON "MagicItem"("name");
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "abbreviationEn" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Source" ("abbreviation", "createdAt", "id", "name", "updatedAt") SELECT "abbreviation", "createdAt", "id", "name", "updatedAt" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE UNIQUE INDEX "Source_name_key" ON "Source"("name");
CREATE TABLE "new_WikiEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "data" TEXT NOT NULL DEFAULT '{}',
    "sourceId" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nameEn" TEXT NOT NULL DEFAULT '',
    "summaryEn" TEXT NOT NULL DEFAULT '',
    "descriptionEn" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "WikiEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WikiEntry" ("createdAt", "data", "description", "id", "kind", "name", "sourceId", "summary", "updatedAt", "updatedBy") SELECT "createdAt", "data", "description", "id", "kind", "name", "sourceId", "summary", "updatedAt", "updatedBy" FROM "WikiEntry";
DROP TABLE "WikiEntry";
ALTER TABLE "new_WikiEntry" RENAME TO "WikiEntry";
CREATE INDEX "WikiEntry_kind_name_idx" ON "WikiEntry"("kind", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

