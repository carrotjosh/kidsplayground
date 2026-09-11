import Image from "next/image";
import Link from "next/link";

import { CaughtStatus } from "@/generated/prisma/client";
import { getActiveChild } from "@/lib/child";
import { todayAsUtcDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import { ensureBallTypes } from "@/lib/bootstrap";
import { dailyEarnRate, pokedexMilestoneBonus } from "@/lib/economy";
import { levelProgress, totalEarned } from "@/lib/level";
import {
  masteryGoal,
  POKEDEX_MILESTONE_STEP,
  RARITY_LABELS,
  REGION_UNLOCK_RATIO,
  REGIONS,
  regionCeiling,
} from "@/lib/pokedex";
import { pokemonArtPath } from "@/lib/pokemonArt";

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

  const [balls, counts, speciesCount, caught, earned, todaysEncounters] = await Promise.all([
    prisma.ballType.findMany({ where: { childId: child.id } }),
    prisma.caught.groupBy({
      by: ["ballTypeId"],
      where: { childId: child.id },
      _count: { _all: true },
    }),
    prisma.pokemonSpecies.count({ where: { id: { lte: ceiling } } }),
    prisma.caught.findMany({
      where: { childId: child.id },
      orderBy: { caughtAt: "desc" },
    }),
    totalEarned(child.id),
    prisma.dailyEncounter.findMany({
      where: { childId: child.id, date: todayAsUtcDate() },
      orderBy: { slot: "asc" },
    }),
  ]);

  const owned = caught.filter((c) => c.status === CaughtStatus.OWNED);
  const fled = caught.filter((c) => c.status === CaughtStatus.FLED);
  // 按种类归组：孩子端的"牌库"也是这个口径，两边说的"收集了几种"要是同一个数
  const bySpecies = new Map<number, typeof owned>();
  for (const c of owned) {
    const list = bySpecies.get(c.speciesId) ?? [];
    list.push(c);
    bySpecies.set(c.speciesId, list);
  }
  const distinct = bySpecies.size;
  const mastered = [...bySpecies.values()].filter(
    (list) => list.length >= masteryGoal(list[0].rarity)
  ).length;
  const toNextMilestone =
    // 同孩子端：整除时 || 会把结果变成 0，"再收集 0 种"是错的
    POKEDEX_MILESTONE_STEP - (distinct % POKEDEX_MILESTONE_STEP);
  const toNextRegion =
    child.pokedexRegion >= REGIONS.length
      ? null
      : Math.max(0, Math.ceil(ceiling * REGION_UNLOCK_RATIO) - distinct);
  const progress = levelProgress(child.level, earned);
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

      {/* ---- 孩子玩到哪了 ---- */}
      <div className="pixel-card flex flex-col gap-4 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{child.name} 的图鉴进展</h2>
          <span className="text-sm text-slate-500">
            Lv.{progress.level} {progress.title}
            {progress.next !== null && ` · 再挣 ${progress.remaining} 阳光升级`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="收集了" value={`${distinct} 种`} sub={`${regionName}共 ${speciesCount} 种`} />
          <Stat label="一共抓到" value={`${owned.length} 只`} sub={`重复的算张数`} />
          <Stat
            label="收集完成"
            value={`${mastered} 种`}
            sub={`同一种攒够数量才算`}
          />
          <Stat
            label="离家出走"
            value={`${fled.length} 只`}
            sub={fled.length > 0 ? "任务没做完丢的" : "一只都没丢过"}
          />
        </div>

        <div className="flex flex-col gap-1 text-sm text-slate-600">
          <p>
            再收集 <b>{toNextMilestone}</b> 种拿到下一个里程碑奖励（{milestoneBonus} 阳光）。
          </p>
          {toNextRegion !== null && (
            <p>
              再收集 <b>{toNextRegion}</b> 种解锁
              <b>{REGIONS[child.pokedexRegion].name}地区</b>（会多出{" "}
              {REGIONS[child.pokedexRegion].ceiling - ceiling} 种新宝可梦）。
            </p>
          )}
          <p>
            今天遇到：
            {todaysEncounters.length === 0
              ? "还没打开过图鉴"
              : todaysEncounters
                  .map(
                    (e) =>
                      `${e.nameZh}（${RARITY_LABELS[e.rarity]}${e.isShiny ? "·闪光" : ""}，${
                        e.status === "CAUGHT" ? "抓到了" : e.status === "FLED" ? "跑掉了" : "还能抓"
                      }）`
                  )
                  .join("、")}
          </p>
        </div>

        {/* 最近抓到的几只。家长看这个不是为了统计，是为了能接上孩子的话 */}
        {owned.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-slate-500">最近抓到的</p>
            <div className="flex flex-wrap gap-2">
              {owned.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  href={`/kid/${child.slug}/pokedex/${c.speciesId}`}
                  className="flex w-20 flex-col items-center border-2 border-slate-200 p-1 text-center transition hover:border-nes-black"
                  title={`${c.nameZh} · ${RARITY_LABELS[c.rarity]}`}
                >
                  <Image
                    src={pokemonArtPath(c.speciesId)}
                    alt={c.nameZh}
                    width={56}
                    height={56}
                    unoptimized
                  />
                  <span className="truncate text-xs text-slate-600">
                    {c.isShiny && "✨"}
                    {c.nameZh}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <h2 className="font-semibold">精灵球目录</h2>

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

/** 进展区里的一个小数字块。四个并排，标题和数字对齐。 */
function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-2 border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
