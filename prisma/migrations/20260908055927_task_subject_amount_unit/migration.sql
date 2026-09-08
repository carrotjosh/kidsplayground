-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "DailyTask" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "unit" TEXT;

-- 手动追加：已有任务没有拆分过，先把整个 title 当成"主题"回填，
-- 家长以后编辑时再补数值和单位；这样老数据在孩子端也能正常显示，不会出现空白主题。
UPDATE "TaskTemplate" SET "subject" = "title" WHERE "subject" IS NULL;
UPDATE "DailyTask" SET "subject" = "title" WHERE "subject" IS NULL;
