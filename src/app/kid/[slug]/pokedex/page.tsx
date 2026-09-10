import { notFound, redirect } from "next/navigation";

import { CreatureCard } from "@/components/CreatureCard";
import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { CaughtStatus, KidTheme } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";
import {
  POKEDEX_MILESTONE_BONUS,
  POKEDEX_MILESTONE_STEP,
  RARITY_LABELS,
  settlePokedexForChild,
} from "@/lib/pokedex";

import { BallShop } from "./BallShop";

export const dynamic = "force-dynamic";

export default async function PokedexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  // 主题互斥：花园主题的孩子不该看到图鉴，直接送回首页
  if (child.theme !== KidTheme.POKEDEX) redirect(`/kid/${slug}`);

  // 懒结算：把欠下的"离家出走"判定补齐，返回这次新发生的事件做一次性提示
  const events = await settlePokedexForChild(child.id);

  const [caught, balls, balance, totalSpecies] = await Promise.all([
    prisma.caught.findMany({
      where: { childId: child.id },
      orderBy: [{ rarity: "desc" }, { caughtAt: "desc" }],
    }),
    prisma.ballType.findMany({
      where: { childId: child.id, active: true },
      orderBy: { cost: "asc" },
    }),
    getPointsBalance(child.id),
    prisma.pokemonSpecies.count(),
  ]);

  const owned = caught.filter((c) => c.status === CaughtStatus.OWNED);
  const fled = caught.filter((c) => c.status === CaughtStatus.FLED);
  const distinctCount = new Set(owned.map((c) => c.speciesId)).size;
  // 距离下一个里程碑还差几种
  const toNextMilestone =
    POKEDEX_MILESTONE_STEP - (distinctCount % POKEDEX_MILESTONE_STEP || POKEDEX_MILESTONE_STEP);

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-6 lg:p-8 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="我的图鉴" /> 📕
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {/* 任务没完成，宝可梦离家出走了 —— 对应花园主题里僵尸吃植物的提示 */}
      {events.length > 0 && (
        <section className="flex flex-col gap-2">
          {events.map((event, i) => (
            <p key={i} className="pixel-card kid-text bg-nes-red p-4 text-center text-white lg:p-5">
              {event.outcome === "FLED_AWAY"
                ? `💨 ${event.date}：任务没有全部完成，${event.nameZh} 离家出走了！`
                : `💨 ${event.date}：任务没有全部完成，还好图鉴里还没有宝可梦～`}
            </p>
          ))}
        </section>
      )}

      {/* 收集进度 */}
      <section className="pixel-card flex flex-col gap-2 bg-white p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="kid-text text-lg text-slate-800 lg:text-xl">
            <Pinyin text="已经收集" />{" "}
            <span className="text-2xl text-amber-600 lg:text-3xl">{distinctCount}</span>
            <span className="text-slate-500"> / {totalSpecies} </span>
            <Pinyin text="种" />
          </p>
          <p className="kid-text text-sm text-slate-500 lg:text-base">
            <Pinyin text={`再收集 ${toNextMilestone} 种，奖励 ${POKEDEX_MILESTONE_BONUS} 阳光`} /> 🏅
          </p>
        </div>
        <div className="h-3 w-full border-2 border-nes-black bg-slate-100">
          <div
            className="h-full bg-nes-green"
            style={{ width: `${Math.min(100, (distinctCount / totalSpecies) * 100)}%` }}
          />
        </div>
        {/* 各稀有度收集了几只 */}
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2, 1].map((r) => (
            <span
              key={r}
              className="pixel-border kid-text bg-slate-100 px-2 py-1 text-sm text-slate-700"
            >
              {"★".repeat(r)} {RARITY_LABELS[r]} {owned.filter((c) => c.rarity === r).length}
            </span>
          ))}
        </div>
      </section>

      {/* 精灵球商店 */}
      <section className="flex flex-col gap-3">
        <h2 className="pixel-text-outline kid-text text-lg text-white lg:text-xl">
          <Pinyin text="买个球去抓吧" />
        </h2>
        {balls.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-6 text-center text-slate-500">
            <Pinyin text="还没有精灵球，等家长上架吧" />
          </p>
        ) : (
          <BallShop
            slug={slug}
            balls={balls.map((b) => ({ id: b.id, tier: b.tier, title: b.title, cost: b.cost }))}
            balance={balance}
            missStreak={child.catchMissStreak}
            // 固定文案在服务端渲染好再传进去——客户端组件里不能用 <Pinyin>，
            // 它会把 pinyin-pro 的整本字典打进浏览器包（见 BallShop 的注释）。
            labels={{
              ballTitles: Object.fromEntries(
                balls.map((b) => [b.id, <Pinyin key={b.id} text={b.title} />])
              ),
              throwIt: <Pinyin text="扔球！" />,
              notEnough: <Pinyin text="阳光不够" />,
              throwing: <Pinyin text="扔出去…" />,
              luckHint: <Pinyin text={`连续 ${child.catchMissStreak} 次没抓到，下一次运气更高`} />,
            }}
          />
        )}
      </section>

      {/* 图鉴本体 */}
      <section className="flex flex-col gap-3">
        <h2 className="pixel-text-outline kid-text text-lg text-white lg:text-xl">
          <Pinyin text="我抓到的宝可梦" />
        </h2>
        {owned.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-6 text-center text-lg text-slate-500">
            <Pinyin text="还一只都没有，去扔个球试试" /> ⚪
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {owned.map((c) => (
              <CreatureCard key={c.id} creature={c} />
            ))}
          </div>
        )}
      </section>

      {/* 跑掉的那些灰着留在下面，让孩子看得到自己失去了什么 */}
      {fled.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="pixel-text-outline kid-text text-base text-white lg:text-lg">
            <Pinyin text={`离家出走的（${fled.length} 只）`} /> 💨
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {fled.map((c) => (
              <CreatureCard key={c.id} creature={c} faded />
            ))}
          </div>
        </section>
      )}

      <KidNavBar
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}/rewards`, label: "礼物商店", emoji: "🎁", tone: "pink" },
        ]}
      />
    </main>
  );
}
