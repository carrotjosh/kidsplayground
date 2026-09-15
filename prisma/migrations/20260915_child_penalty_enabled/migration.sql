-- 任务没做完的惩罚开关（图鉴宝可梦离家出走 / 花园植物被僵尸吃掉）。
-- 默认 true：现有孩子的行为不变。
ALTER TABLE "Child" ADD COLUMN "penaltyEnabled" BOOLEAN NOT NULL DEFAULT true;
