-- 打卡等级：按累计打卡挣到的阳光升级，只增不减
ALTER TABLE "Child" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;

-- 礼物 / 精灵球的解锁等级。默认 1 = 现有条目一律保持可见，不会有东西突然从孩子端消失。
ALTER TABLE "Reward" ADD COLUMN "unlockLevel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BallType" ADD COLUMN "unlockLevel" INTEGER NOT NULL DEFAULT 1;
