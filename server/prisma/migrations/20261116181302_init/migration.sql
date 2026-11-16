-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "language" TEXT NOT NULL DEFAULT 'de',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Spell" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "school" TEXT NOT NULL,
    "castingTime" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "verbal" BOOLEAN NOT NULL DEFAULT false,
    "somatic" BOOLEAN NOT NULL DEFAULT false,
    "material" BOOLEAN NOT NULL DEFAULT false,
    "concentration" BOOLEAN NOT NULL DEFAULT false,
    "ritual" BOOLEAN NOT NULL DEFAULT false,
    "duration" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Homebrew',
    "isHomebrew" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "sortNameDe" TEXT NOT NULL DEFAULT '',
    "sortNameEn" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SpellTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spellId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialDescription" TEXT,
    "castingTimeText" TEXT,
    "rangeText" TEXT,
    "durationText" TEXT,
    "description" TEXT NOT NULL,
    "higherLevels" TEXT,
    CONSTRAINT "SpellTranslation_spellId_fkey" FOREIGN KEY ("spellId") REFERENCES "Spell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SpellClassLink" (
    "spellId" TEXT NOT NULL,
    "className" TEXT NOT NULL,

    PRIMARY KEY ("spellId", "className"),
    CONSTRAINT "SpellClassLink_spellId_fkey" FOREIGN KEY ("spellId") REFERENCES "Spell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "spellId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "spellId"),
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_spellId_fkey" FOREIGN KEY ("spellId") REFERENCES "Spell" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Spell_slug_key" ON "Spell"("slug");

-- CreateIndex
CREATE INDEX "Spell_level_idx" ON "Spell"("level");

-- CreateIndex
CREATE INDEX "Spell_school_idx" ON "Spell"("school");

-- CreateIndex
CREATE INDEX "Spell_castingTime_idx" ON "Spell"("castingTime");

-- CreateIndex
CREATE INDEX "Spell_sortNameDe_idx" ON "Spell"("sortNameDe");

-- CreateIndex
CREATE INDEX "Spell_sortNameEn_idx" ON "Spell"("sortNameEn");

-- CreateIndex
CREATE INDEX "SpellTranslation_locale_idx" ON "SpellTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "SpellTranslation_spellId_locale_key" ON "SpellTranslation"("spellId", "locale");

-- CreateIndex
CREATE INDEX "SpellClassLink_className_idx" ON "SpellClassLink"("className");

-- CreateIndex
CREATE INDEX "Favorite_spellId_idx" ON "Favorite"("spellId");
