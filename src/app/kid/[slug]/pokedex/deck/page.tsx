import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CreatureCard } from "@/components/CreatureCard";
import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { CaughtStatus, KidTheme } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";
import { masteryGoal } from "@/lib/pokedex";

export const dynamic = "force-dynamic";

/**
 * 牌库单独一页。
 *
 * 本来它在图鉴页最下面。孩子端锁成一屏之后，上半截（收集进度 + 今天遇到的两只）
 * 就把屏幕占满了，牌库整个在折叠线以下——孩子根本不知道有这么个地方，
 * "我抓到的宝可梦在哪看"就变成了一个真问题。拆出来放进底部导航，一步就到。
 */
export default async function DeckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  if (child.theme !== KidTheme.POKEDEX) redirect(`/kid/${slug}`);

  const [caught, balance] = await Promise.all([
    prisma.caught.findMany({
      where: { childId: child.id },
      orderBy: [{ rarity: "desc" }, { caughtAt: "desc" }],
    }),
    getPointsBalance(child.id),
  ]);

  const owned = caught.filter((c) => c.status === CaughtStatus.OWNED);
  const fled = caught.filter((c) => c.status === CaughtStatus.FLED);

  // 按种类归组：同一种抓到几只只占一张卡，右上角标 ×N。
  // owned 已经按 rarity desc + caughtAt desc 排过，所以每组第一只就是代表卡。
  const deckMap = new Map<number, { representative: (typeof owned)[number]; count: number }>();
  for (const c of owned) {
    const hit = deckMap.get(c.speciesId);
    if (hit) hit.count += 1;
    else deckMap.set(c.speciesId, { representative: c, count: 1 });
  }
  const deck = [...deckMap.values()];
  const mastered = deck.filter((d) => d.count >= masteryGoal(d.representative.rarity)).length;

  return (
    <main className="pixel-sky-bg mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 overflow-hidden p-4 md:max-w-3xl lg:max-w-5xl lg:gap-4 lg:p-6 2xl:max-w-6xl">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="我的牌库" /> 🗂️
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <p className="pixel-card kid-text shrink-0 bg-white p-3 text-base text-slate-700 lg:text-lg">
        <Pinyin text={`${deck.length} 种 · 一共 ${owned.length} 只 · 已集满 ${mastered} 种`} />
        <span className="ml-3 text-sm text-slate-500">
          {[4, 3, 2, 1].map((r) => (
            <span key={r} className="mr-2">
              {"★".repeat(r)}
              {owned.filter((c) => c.rarity === r).length}
            </span>
          ))}
        </span>
      </p>

      {/* 卡片可能有几百张，页面框不动，只让这一块滚 */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {deck.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-6 text-center text-lg text-slate-500">
            <Pinyin text="还一只都没有，回图鉴扔个球试试" /> ⚪
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {deck.map(({ representative, count }) => (
              <Link key={representative.id} href={`/kid/${slug}/pokedex/${representative.speciesId}`}>
                <CreatureCard
                  creature={representative}
                  count={count}
                  goal={masteryGoal(representative.rarity)}
                />
              </Link>
            ))}
          </div>
        )}

        {/* 跑掉的灰着留在下面，让孩子看得到自己失去了什么 */}
        {fled.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="pixel-text-outline kid-text text-base text-white lg:text-lg">
              <Pinyin text={`离家出走的（${fled.length} 只）`} /> 💨
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {fled.map((c) => (
                <Link key={c.id} href={`/kid/${slug}/pokedex/${c.speciesId}`}>
                  <CreatureCard creature={c} faded />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <KidNavBar
        compact
        items={[
          { href: `/kid/${slug}/pokedex`, label: "回图鉴", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}/pokedex/all`, label: "全部宝可梦", emoji: "📖", tone: "pink" },
        ]}
      />
    </main>
  );
}
