-- AlterTable
-- 只改默认值，不动已有孩子的实际达标线（那个由家长在后台设置）
ALTER TABLE "Child" ALTER COLUMN "dailyGoalPoints" SET DEFAULT 20;
