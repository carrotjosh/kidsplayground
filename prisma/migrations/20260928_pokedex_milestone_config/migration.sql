-- 图鉴里程碑改成可配置：奖励金额和「每几种发一次」都能由家长固定。
-- 都可空，null = 沿用按达标线自动算的默认值，现有档案行为不变。
ALTER TABLE "Child" ADD COLUMN "pokedexMilestoneBonus" INTEGER;
ALTER TABLE "Child" ADD COLUMN "pokedexMilestoneStep" INTEGER;
