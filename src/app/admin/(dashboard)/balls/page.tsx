import { getActiveChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { ensureBallTypes } from "@/lib/bootstrap";
import { POKEDEX_MILESTONE_BONUS, POKEDEX_MILESTONE_STEP } from "@/lib/pokedex";

import { BallRow } from "./BallRow";

export const dynamic = "force-dynamic";

const TIER_ORDER = { POKE: 0, GREAT: 1, ULTRA: 2, MASTER: 3 } as const;

export default async function BallsAdminPage() {
  const child = await getActiveChild();
  // 主题上线前建的孩子档案没有精灵球目录，进这一页时补上
  await ensureBallTypes(child.id);

  const [balls, counts, speciesCount] = await Promise.all([
    prisma.ballType.findMany({ where: { childId: child.id } }),
    prisma.caught.groupBy({
      by: ["ballTypeId"],
      where: { childId: child.id },
      _count: { _all: true },
    }),
    prisma.pokemonSpecies.count(),
  ]);
  const byBall = new Map(counts.map((c) => [c.ballTypeId, c._count._all]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">精灵球</h1>

      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        图鉴里一共 {speciesCount} 只宝可梦。孩子每收集满 <b>{POKEDEX_MILESTONE_STEP} 个不同种类</b>
        奖励 {POKEDEX_MILESTONE_BONUS} 阳光。
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
