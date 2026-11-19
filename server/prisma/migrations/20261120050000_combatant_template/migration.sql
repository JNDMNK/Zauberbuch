-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Combatant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "encounterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "characterId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "initiative" INTEGER,
    "ac" INTEGER,
    "hpCurrent" INTEGER NOT NULL DEFAULT 0,
    "hpMax" INTEGER NOT NULL DEFAULT 0,
    "hideStats" BOOLEAN NOT NULL DEFAULT true,
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "attack" TEXT NOT NULL DEFAULT '',
    "damageDice" TEXT,
    "damageType" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Combatant_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Combatant_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Combatant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MonsterTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Combatant" ("ac", "attack", "characterId", "conditions", "createdAt", "damageDice", "damageType", "description", "encounterId", "hideStats", "hpCurrent", "hpMax", "id", "initiative", "kind", "name") SELECT "ac", "attack", "characterId", "conditions", "createdAt", "damageDice", "damageType", "description", "encounterId", "hideStats", "hpCurrent", "hpMax", "id", "initiative", "kind", "name" FROM "Combatant";
DROP TABLE "Combatant";
ALTER TABLE "new_Combatant" RENAME TO "Combatant";
CREATE INDEX "Combatant_encounterId_idx" ON "Combatant"("encounterId");
CREATE INDEX "Combatant_characterId_idx" ON "Combatant"("characterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

