-- 删除花园玩法（植物大战僵尸）。当前只做宝可梦图鉴。
--
-- 动手前先确认没有真实数据会被误删：有植物、或有孩子还停在花园主题，就直接报错停下。
-- 花园的 PlantType 是默认目录（可以重新生成），没有任何 Plant 实例，也没有花园流水。

-- 安全检查：有植物、或有孩子还在花园主题，就故意除以零让整个迁移失败（分母写成依赖查询的值，否则 Postgres 会在计划阶段就把 1/0 折叠掉、每次都失败）（回滚，什么都不删）。
-- 不用 DO 块，是因为 scripts/apply-migration-via-http.ts 按分号切语句，会切坏 DO 块。
SELECT 1 / CASE WHEN (SELECT count(*) FROM "Plant") > 0 THEN 0 ELSE 1 END;
SELECT 1 / CASE WHEN (SELECT count(*) FROM "Child" WHERE "theme"::text = 'GARDEN') > 0 THEN 0 ELSE 1 END;

-- 流水上的植物外键
ALTER TABLE "PointsLedger" DROP CONSTRAINT IF EXISTS "PointsLedger_plantId_fkey";
DROP INDEX IF EXISTS "PointsLedger_plantId_key";
ALTER TABLE "PointsLedger" DROP COLUMN IF EXISTS "plantId";

-- 植物本体
DROP TABLE IF EXISTS "Plant";
DROP TABLE IF EXISTS "PlantType";
DROP TYPE IF EXISTS "PlantStatus";

-- 孩子上的花园等级
ALTER TABLE "Child" DROP COLUMN IF EXISTS "gardenStage";

-- 主题枚举只剩 POKEDEX。Postgres 不能直接删枚举值，所以重建一个。
ALTER TABLE "Child" ALTER COLUMN "theme" DROP DEFAULT;
ALTER TYPE "KidTheme" RENAME TO "KidTheme_old";
CREATE TYPE "KidTheme" AS ENUM ('POKEDEX');
ALTER TABLE "Child" ALTER COLUMN "theme" TYPE "KidTheme" USING ("theme"::text::"KidTheme");
ALTER TABLE "Child" ALTER COLUMN "theme" SET DEFAULT 'POKEDEX';
DROP TYPE "KidTheme_old";
