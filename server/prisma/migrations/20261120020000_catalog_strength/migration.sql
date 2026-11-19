-- AlterTable
ALTER TABLE "CatalogItem" ADD COLUMN "strength" INTEGER;


-- Stärkeanforderung (SRD) der mitgelieferten schweren Rüstungen nachtragen; angepasste Einträge übernehmen sie
UPDATE "CatalogItem" SET "strength" = 13 WHERE "storyId" IS NULL AND "category" = 'armor' AND "name" = 'Kettenpanzer';
UPDATE "CatalogItem" SET "strength" = 15 WHERE "storyId" IS NULL AND "category" = 'armor' AND "name" IN ('Schienenpanzer', 'Plattenpanzer');
UPDATE "CatalogItem" SET "strength" = (SELECT b."strength" FROM "CatalogItem" b WHERE b."id" = "CatalogItem"."baseId") WHERE "baseId" IS NOT NULL AND "strength" IS NULL AND "category" = 'armor';
