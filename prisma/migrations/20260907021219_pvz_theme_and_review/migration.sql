-- CreateEnum
CREATE TYPE "PlantStatus" AS ENUM ('ALIVE', 'EATEN');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'PENDING_REVIEW';

-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'PLANT_SEED';

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "gardenSettledThrough" DATE;

-- AlterTable
ALTER TABLE "PointsLedger" ADD COLUMN     "plantId" TEXT;

-- CreateTable
CREATE TABLE "PlantType" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "cost" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "plantTypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT,
    "slot" INTEGER NOT NULL,
    "status" "PlantStatus" NOT NULL DEFAULT 'ALIVE',
    "plantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eatenAt" TIMESTAMP(3),
    "eatenOnDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantType_childId_idx" ON "PlantType"("childId");

-- CreateIndex
CREATE INDEX "Plant_childId_status_idx" ON "Plant"("childId", "status");

-- CreateIndex
CREATE INDEX "Plant_childId_slot_idx" ON "Plant"("childId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_plantId_key" ON "PointsLedger"("plantId");

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantType" ADD CONSTRAINT "PlantType_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_plantTypeId_fkey" FOREIGN KEY ("plantTypeId") REFERENCES "PlantType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 手动追加：给已有孩子设置花园结算游标起点为"昨天"，避免功能上线前的历史日子被误判成僵尸夜袭。
UPDATE "Child" SET "gardenSettledThrough" = (CURRENT_DATE - INTERVAL '1 day') WHERE "gardenSettledThrough" IS NULL;
