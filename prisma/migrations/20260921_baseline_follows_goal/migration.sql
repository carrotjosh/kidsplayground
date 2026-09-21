-- 定价基准从「任务分值之和」改成「每日达标线」。
-- 现有档案的 priceBaselineRate 记的是旧口径（任务总分），换锚之后会被当成
-- 巨大的漂移（蓬蓬：48 → 20，报 0.42×）。价格本身没动过，不该提示校准，
-- 所以把基准对齐到各自当前的达标线。
ALTER TABLE "Child" ALTER COLUMN "priceBaselineRate" SET DEFAULT 20;
UPDATE "Child" SET "priceBaselineRate" = "dailyGoalPoints";
