-- DropForeignKey
ALTER TABLE "Plant" DROP CONSTRAINT "Plant_plantTypeId_fkey";

-- AlterTable
ALTER TABLE "Plant" ALTER COLUMN "plantTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_plantTypeId_fkey" FOREIGN KEY ("plantTypeId") REFERENCES "PlantType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
