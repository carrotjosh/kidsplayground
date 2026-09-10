import { getActiveChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { ensureBallTypes } from "@/lib/bootstrap";
import { dailyEarnRate, pokedexMilestoneBonus } from "@/lib/economy";
import { POKEDEX_MILESTONE_STEP, REGIONS, regionCeiling } from "@/lib/pokedex";

import { BallRow } from "./BallRow";

export const dynamic = "force-dynamic";

const TIER_ORDER = { POKE: 0, GREAT: 1, ULTRA: 2, MASTER: 3 } as const;

export default async function BallsAdminPage() {
  const child = await getActiveChild();
  // 主题上线前建的孩子档案没有精灵球目录，进这一页时补上
  await ensureBallTypes(child.id);

  const ceiling = regionCeiling(child.pokedexRegion);
  const regionName = REGIONS[Math.min(child.pokedexRegion, REGIONS.length) - 1].name;
  const milestoneBonus = pokedexMilestoneBonus(await dailyEarnRate(child.id));

  const [balls, counts, speciesCount] = await Promise.all([
    prisma.ballType.findMany({ where: { childId: child.id } }),
    prisma.caught.groupBy({
      by: ["ballTypeId"],
      where: { childId: child.id },
      _count: { _all: true },
    }),
    prisma.pokemonSpecies.count({ where: { id: { lte: ceiling } } }),
  ]);
  const byBall = new Map(counts.map((c) => [c.ballTypeId, c._count._all]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">精灵球</h1>

      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        当前开放到 <b>{regionName}地区</b>，共 {speciesCount} 只宝可梦（收集到 80% 会自动开放下一个地区）。
        孩子每收集满 <b>{POKEDEX_MILESTONE_STEP} 个不同种类</b> 奖励 {milestoneBonus} 阳光——
        这个数字按当前日薪自动算，改任务模板会跟着变，不用手工维护。
        <br />
        <b>这里只能改价格和上下架</b>——四个等级的抓取倍率是玩法平衡的一部分，改了很容易把经济搞坏；
        价格才是该按自家阳光产出来调的。球越贵，遇到稀有宝可梦的概率越高、也越抓得住。
      </p>

      <div className="flex flex-col gap-3">
        {[...balls]
          .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
          .map((ball) => (
            <BallRow key={ball.id} ball={ball} caughtCount={byBall.get(ball.id) ?? 0} />
          ))}
      </div>
    </div>
  );
}
