-- 图鉴分批解锁：已解锁到第几个地区（1 关都 / 2 城都 / 3 丰缘）
ALTER TABLE "Child" ADD COLUMN "pokedexRegion" INTEGER NOT NULL DEFAULT 1;

-- 价格校准基准：现有目录价格是按哪个日薪定的
ALTER TABLE "Child" ADD COLUMN "priceBaselineRate" INTEGER NOT NULL DEFAULT 25;

-- 孩子自己提交打卡的时间（区别于家长批准的 completedAt）
ALTER TABLE "DailyTask" ADD COLUMN "submittedAt" TIMESTAMP(3);
