import { notFound, redirect } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { LevelUpBanner } from "@/components/LevelUpBanner";
import { PointsBadge } from "@/components/PointsBadge";
import { BallTier, CaughtStatus, KidTheme } from "@/generated/prisma/client";
import { dateStringToUtcDate, todayDateString } from "@/lib/date";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { checkLevelUp } from "@/lib/level";
import { getPointsBalance } from "@/lib/points";
import { dailyEarnRate, pokedexMilestoneBonus, refreshCosts } from "@/lib/economy";
import {
  catchProbability,
  ensureTodayEncounters,
  MAX_ATTEMPTS_PER_ENCOUNTER,
  POKEDEX_MILESTONE_STEP,
  MAX_REFRESHES_PER_DAY,
  RARITY_LABELS,
  REGIONS,
  regionAt,
  speciesCeilingForLevel,
  settlePokedexForChild,
} from "@/lib/pokedex";

import { refreshEncountersAction } from "./actions";
import { EncounterBoard } from "./EncounterBoard";
import { RefreshButton } from "./RefreshButton";

export const dynamic = "force-dynamic";

export default async function PokedexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  // 主题互斥：花园主题的孩子不该看到图鉴，直接送回首页
  if (child.theme !== KidTheme.POKEDEX) redirect(`/kid/${slug}`);

  // 懒结算：把欠下的"离家出走"判定补齐，返回这次新发生的事件做一次性提示
  const events = await settlePokedexForChild(child.id);

  // 升级检查必须排在 ensureTodayEncounters 前面：图鉴开放到第几号是按等级算的，
  // 放后面的话今天的名单已经按旧上限摇好了，新解锁的那批要等明天才可能出现。
  const levelUp = await checkLevelUp(child.id);
  const level = levelUp?.level ?? child.level;

  // 今天遇到谁：一天只生成一次，刷新页面不会重摇（否则一直刷就能刷出传说）
  const today = todayDateString();
  await ensureTodayEncounters(child.id, today);

  // 各种奖励金额都跟着日薪走（见 lib/economy.ts），家长改了任务模板会自动跟上
  const rate = await dailyEarnRate(child.id);
  const milestoneBonus = pokedexMilestoneBonus(rate);
  // 收集进度的分母只算**等级已经放出来的**那些。用全库 386 当分母的话，
  // 刚开始玩的孩子看到的是 3/386 的进度条，等于一上来就告诉他"你永远集不完"。
  const ceiling = speciesCeilingForLevel(level);
  const regionName = regionAt(ceiling);

  const [caught, balls, balance, totalSpecies, encounters] = await Promise.all([
    prisma.caught.findMany({
      where: { childId: child.id },
      orderBy: [{ rarity: "desc" }, { caughtAt: "desc" }],
    }),
    prisma.ballType.findMany({
      where: { childId: child.id, active: true },
      orderBy: { cost: "asc" },
    }),
    getPointsBalance(child.id),
    prisma.pokemonSpecies.count({ where: { id: { lte: ceiling } } }),
    prisma.dailyEncounter.findMany({
      where: { childId: child.id, date: dateStringToUtcDate(today) },
      orderBy: { slot: "asc" },
    }),
  ]);

  const owned = caught.filter((c) => c.status === CaughtStatus.OWNED);
  const distinctCount = new Set(owned.map((c) => c.speciesId)).size;
  // 今天刷了几次 = 当天最大的 refreshRound（见 schema 里的注释）
  const refreshesUsed = Math.max(0, ...encounters.map((e) => e.refreshRound));
  const costs = refreshCosts(rate);
  const nextRefreshCost = costs[Math.min(refreshesUsed, costs.length - 1)];

  const toNextMilestone =
    // 不能写成 (n % STEP || STEP)：n 是 STEP 的整数倍时那个 || 会让结果变成 0，
    // 界面上就成了"再收集 0 种"。取模本身在整除时就返回 0，STEP - 0 = STEP 才是对的。
    POKEDEX_MILESTONE_STEP - (distinctCount % POKEDEX_MILESTONE_STEP);

  return (
    // 框固定一屏。上半截（进度 + 今天遇到谁）是每天都要看的，必须常驻；
    // 牌库会长到几百张，只让它自己滚。
    <main className="pixel-sky-bg mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 overflow-hidden p-4 md:max-w-3xl lg:max-w-5xl lg:gap-4 lg:p-6 2xl:max-w-6xl">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="我的图鉴" /> 📕
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {levelUp && <LevelUpBanner levelUp={levelUp} />}

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
      <section className="pixel-card flex shrink-0 flex-col gap-2 bg-white p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {/* 分母是**当前地区**的数量，不是全部 386。不写清楚"关都地区"的话，
              看到 151 会以为一共就这么多——那正好抹掉了分批解锁想制造的期待感 */}
          <p className="kid-text text-lg text-slate-800 lg:text-xl">
            <Pinyin text={`${regionName}地区已经收集`} />{" "}
            <span className="text-2xl text-amber-600 lg:text-3xl">{distinctCount}</span>
            <span className="text-slate-500"> / {totalSpecies} </span>
            <Pinyin text="种" />
          </p>
          <p className="kid-text text-sm text-slate-500 lg:text-base">
            <Pinyin text={`再收集 ${toNextMilestone} 种，奖励 ${milestoneBonus} 阳光`} /> 🏅
          </p>
        </div>
        <div className="h-3 w-full border-2 border-nes-black bg-slate-100">
          <div
            className="h-full bg-nes-green"
            style={{ width: `${Math.min(100, (distinctCount / totalSpecies) * 100)}%` }}
          />
        </div>
        {/* 后面还有多少没开放。不说的话孩子会以为图鉴就这些，
            而按等级分批放出来的全部意义就在于"后面还有" */}
        {ceiling < REGIONS[REGIONS.length - 1].ceiling && (
          <p className="kid-text text-sm text-slate-500 lg:text-base">
            <Pinyin
              text={`升到 ${level + 1} 级再开放 ${speciesCeilingForLevel(level + 1) - ceiling} 只，后面一共还有 ${REGIONS[REGIONS.length - 1].ceiling - ceiling} 只没见过面`}
            />{" "}
            🌏
          </p>
        )}

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

      {/* 今天遇到的宝可梦 —— 先看到有谁，再决定用什么球。这是每天必看的，不放进滚动区 */}
      <section className="flex shrink-0 flex-col gap-3">
        <h2 className="pixel-text-outline kid-text text-lg text-white lg:text-xl">
          <Pinyin text="今天遇到了" /> 👀
        </h2>
        {/* 有偿刷新：两只都不想要的时候，给孩子一个主动改变局面的选项 */}
        {encounters.length > 0 && (
          <RefreshButton
            action={refreshEncountersAction.bind(null, slug)}
            disabled={refreshesUsed >= MAX_REFRESHES_PER_DAY || balance < nextRefreshCost}
            label={
              refreshesUsed >= MAX_REFRESHES_PER_DAY ? (
                <Pinyin text="今天的刷新用完啦" />
              ) : balance < nextRefreshCost ? (
                <Pinyin text={`刷新要 ${nextRefreshCost} 阳光，还不够`} />
              ) : (
                <Pinyin
                  text={`换一批（${nextRefreshCost} 阳光，今天还能刷 ${MAX_REFRESHES_PER_DAY - refreshesUsed} 次）`}
                />
              )
            }
            confirmText={`花 ${nextRefreshCost} 阳光换两只新的？已经抓到的会留着。`}
          />
        )}

        {child.catchMissStreak > 0 && (
          <p className="pixel-card kid-text bg-nes-yellow p-3 text-center text-base text-nes-black lg:text-lg">
            <Pinyin text={`连续 ${child.catchMissStreak} 次没抓到，下一次运气更高`} /> 🍀
          </p>
        )}
        {balls.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-6 text-center text-slate-500">
            <Pinyin text="还没有精灵球，等家长上架吧" />
          </p>
        ) : encounters.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-6 text-center text-slate-500">
            <Pinyin text="今天还没有遇到宝可梦，刷新一下试试" />
          </p>
        ) : (
          <EncounterBoard
            slug={slug}
            balance={balance}
            encounters={encounters.map((e) => ({
              id: e.id,
              speciesId: e.speciesId,
              nameZh: e.nameZh,
              types: e.types,
              rarity: e.rarity,
              gender: e.gender,
              ability: e.ability,
              moveName: e.moveName,
              movePower: e.movePower,
              hp: e.hp,
              attack: e.attack,
              defense: e.defense,
              speed: e.speed,
              isShiny: e.isShiny,
              attemptsLeft: MAX_ATTEMPTS_PER_ENCOUNTER - e.attemptsUsed,
              status: e.status,
            }))}
            // 成功率是"该用哪个球"唯一有意义的依据，所以直接摆在按钮上。
            // 只能在服务端算：catchProbability 在 lib/pokedex 里，那是个服务端模块。
            // 注意每只的稀有度不同，所以这份表是按 encounter 分开算的。
            ballsByEncounter={Object.fromEntries(
              encounters.map((e) => [
                e.id,
                balls.map((b) => ({
                  id: b.id,
                  tier: b.tier,
                  cost: b.cost,
                  chance:
                    b.tier === BallTier.MASTER
                      ? 1
                      : catchProbability(e.rarity, b.catchPower, child.catchMissStreak),
                })),
              ])
            )}
            labels={{
              ballTitles: Object.fromEntries(
                balls.map((b) => [b.id, <Pinyin key={b.id} text={b.title} />])
              ),
              names: Object.fromEntries(
                encounters.map((e) => [e.id, <Pinyin key={e.id} text={e.nameZh} />])
              ),
              details: Object.fromEntries(
                encounters.map((e) => [
                  e.id,
                  <Pinyin key={e.id} text={`${e.ability} · ${e.moveName} ${e.movePower}`} />,
                ])
              ),
              // 预渲染每种剩余次数的文案：函数没法传给客户端组件
              attemptsLeft: Object.fromEntries(
                Array.from({ length: MAX_ATTEMPTS_PER_ENCOUNTER }, (_, i) => [
                  i + 1,
                  <Pinyin key={i} text={`还有 ${i + 1} 次机会`} />,
                ])
              ),
              caught: <Pinyin text="抓到啦！" />,
              fled: <Pinyin text="跑掉了，明天再来" />,
              notEnough: <Pinyin text="阳光不够，先去做任务" />,
              throwing: <Pinyin text="扔出去…" />,
              shiny: <Pinyin text="闪光！" />,
            }}
          />
        )}
      </section>


      <KidNavBar
        compact
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}/pokedex/deck`, label: "我的牌库", emoji: "🗂️", tone: "green" },
          { href: `/kid/${slug}/pokedex/all`, label: "全部宝可梦", emoji: "📖", tone: "pink" },
        ]}
      />
    </main>
  );
}
