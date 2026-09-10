-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'GARDEN_BONUS';

-- AlterEnum
ALTER TYPE "PlantStatus" ADD VALUE 'HARVESTED';

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "harvestedAt" TIMESTAMP(3);
