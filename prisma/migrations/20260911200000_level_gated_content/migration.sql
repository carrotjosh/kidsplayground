-- 图鉴开放到第几号改成由打卡等级直接算出来（见 lib/pokedex.ts 的 SPECIES_CEILING_BY_LEVEL），
-- 不再需要单独存"解锁到第几个地区"。
--
-- 原来的触发条件是"收集到当前地区的 80%"，那奖励的是在游戏里刷（多买球多抓），
-- 而不是打卡。内容是这套系统里最硬的激励，该由"干了多少活"决定。
ALTER TABLE "Child" DROP COLUMN "pokedexRegion";
