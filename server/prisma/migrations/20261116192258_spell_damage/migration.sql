-- AlterTable
ALTER TABLE "Spell" ADD COLUMN "damageDice" TEXT;
ALTER TABLE "Spell" ADD COLUMN "damageType" TEXT;

-- CreateIndex
CREATE INDEX "Spell_damageType_idx" ON "Spell"("damageType");
