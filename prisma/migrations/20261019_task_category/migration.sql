-- 任务分类：给家长看「孩子更爱做哪类任务」。都可空，老数据由脚本按任务名回填。
CREATE TYPE "TaskCategory" AS ENUM ('STUDY', 'READING', 'SPORT', 'CHORE', 'HABIT', 'ART', 'OTHER');
ALTER TABLE "TaskTemplate" ADD COLUMN "category" "TaskCategory";
ALTER TABLE "DailyTask" ADD COLUMN "category" "TaskCategory";
