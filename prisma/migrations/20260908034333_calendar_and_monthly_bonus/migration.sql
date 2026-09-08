-- AlterEnum
ALTER TYPE "LedgerType" ADD VALUE 'MONTHLY_BONUS';

-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "bonusSettledThrough" DATE,
ADD COLUMN     "dailyGoalPoints" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "plantedOnDate" DATE;

-- CreateIndex
CREATE INDEX "Plant_childId_plantedOnDate_idx" ON "Plant"("childId", "plantedOnDate");

-- 手动追加 1：给已有植物回填"种下那一天"（按中国时区换算，plantedAt 存的是 UTC）。
UPDATE "Plant"
SET "plantedOnDate" = ("plantedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai')::date
WHERE "plantedOnDate" IS NULL;

-- 手动追加 2：把满勤奖结算游标设成"上个月"，这样当月结束后才开始第一次结算，
-- 不会给功能上线之前的历史月份补发奖励。
UPDATE "Child"
SET "bonusSettledThrough" = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')::date
WHERE "bonusSettledThrough" IS NULL;
