import { notFound } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { KidTheme } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { getGardenRoadmap, getHarvestedRounds } from "@/lib/garden";
import { checkLevelUp, getLevelRoadmap, levelProgress, totalEarned } from "@/lib/level";
import { getPointsBalance } from "@/lib/points";
import { collectionNavItem } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * 等级之路：把全部等级摊开给孩子看。
 *
 * 光把道具锁上、不给路线图，孩子的体验就只是"东西少了"。他需要看见
 * "再打多少卡就有新球"，也需要看见尽头在哪儿——**锁本身不是动力，看得见的目标才是**。
 * 所以这一页把每一级要多少累计阳光、叫什么称号、解锁什么全列出来，
 * 已达成的打勾、当前那一级高亮并画进度条、后面的照常显示不遮挡。
 */
export default async function LevelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();

  const levelUp = await checkLevelUp(child.id);
  const level = levelUp?.level ?? child.level;

  const [earned, balance, gardenPath, rounds] = await Promise.all([
    totalEarned(child.id),
    getPointsBalance(child.id),
    // 花园主题的植物走的是另一条线（按收获轮数），孩子同样要看得见它的尽头
    child.theme === KidTheme.GARDEN
      ? getGardenRoadmap(child.id, child.gardenStage)
      : Promise.resolve([]),
    child.theme === KidTheme.GARDEN ? getHarvestedRounds(child.id) : Promise.resolve(0),
  ]);
  const roadmap = getLevelRoadmap(level);
  const progress = levelProgress(level, earned);

  return (
    // 同其它孩子端页面：框固定一屏，只让下面那条长长的等级列表自己滚
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text kid-title text-white">
          <Pinyin text="等级之路" /> 🏅
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <section className="pixel-card flex shrink-0 flex-col gap-2 bg-white p-4 lg:p-5">
        <p className="kid-text kid-body text-slate-800">
          <Pinyin text={`你现在是 ${progress.level} 级「${progress.title}」`} />
        </p>
        <p className="kid-text kid-label text-slate-500">
          {/* 分子分母都摆出来：只说"还差 300"孩子不知道这是快到了还是刚开始 */}
          <Pinyin
            text={
              progress.next === null
                ? `累计打卡挣到 ${earned} 阳光，已经是最高等级啦！`
                : `累计打卡挣到 ${earned} 阳光，再挣 ${progress.remaining} 就升到 ${progress.level + 1} 级`
            }
          />
        </p>
        {progress.next !== null && (
          <div className="h-4 w-full border-2 border-nes-black bg-slate-100">
            <div
              className="h-full bg-nes-green"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
        )}
        <p className="kid-text kid-label text-slate-400">
          <Pinyin text="只有完成任务和满勤奖算进等级，花掉阳光不会降级" />
        </p>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {roadmap.map((entry) => (
          <div
            key={entry.level}
            className={`pixel-card flex flex-wrap items-center gap-3 p-3 lg:p-4 ${
              entry.current
                ? "bg-nes-yellow"
                : entry.reached
                  ? "bg-white"
                  : "bg-white/70"
            }`}
          >
            <span
              className={`pixel-font flex h-10 w-14 shrink-0 items-center justify-center border-2 border-nes-black text-sm lg:h-12 lg:w-16 lg:text-base ${
                entry.reached ? "bg-nes-green text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {entry.reached ? "✓" : ""} {entry.level}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`kid-text block kid-body ${
                  entry.reached ? "text-slate-800" : "text-slate-500"
                }`}
              >
                <Pinyin text={entry.title} />
              </span>
              <span className="kid-text block kid-label text-slate-400">
                {entry.level === 1 ? (
                  <Pinyin text="一开始就有" />
                ) : (
                  <Pinyin text={`累计挣到 ${entry.need} 阳光`} />
                )}
              </span>
            </span>

            {/* 已达成的打个勾就够了；等级本身不解锁任何东西，称号就是这一级的奖励 */}
            {entry.reached && (
              <span className="kid-text shrink-0 kid-label text-nes-green">
                <Pinyin text="已达成" />
              </span>
            )}
          </div>
        ))}

      {/* 花园之路。和等级是两条独立的线：等级看累计打卡挣的阳光，花园看收获了几轮。
          不合并是因为叠两套门槛之后"我到底什么时候能拿到寒冰射手"就说不清了。 */}
      {gardenPath.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="pixel-text-outline kid-text kid-body text-white">
            <Pinyin text="花园之路" /> 🌻
          </h2>
          <p className="kid-text kid-label text-white">
            <Pinyin
              text={`花园会跟着等级长大，但要等你把当前这一园收获掉才会变。已经收获过 ${rounds} 次`}
            />
          </p>
          {gardenPath.map((entry) => (
            <div
              key={entry.stage}
              className={`pixel-card flex flex-wrap items-center gap-3 p-3 lg:p-4 ${
                entry.current ? "bg-nes-yellow" : entry.reached ? "bg-white" : "bg-white/70"
              }`}
            >
              <span
                className={`pixel-font flex h-10 w-16 shrink-0 items-center justify-center border-2 border-nes-black text-sm lg:h-12 lg:w-20 ${
                  entry.reached ? "bg-nes-green text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {entry.side}×{entry.side}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`kid-text block kid-body ${
                    entry.reached ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  <Pinyin text={`${entry.size} 个格子`} />
                </span>
                <span className="kid-text block kid-label text-slate-400">
                  {entry.needLevel <= 1 ? (
                    <Pinyin text="一开始就有" />
                  ) : (
                    <Pinyin text={`打卡到 ${entry.needLevel} 级`} />
                  )}
                </span>
              </span>
              <span className="kid-text shrink-0 kid-label text-slate-600">
                {entry.unlocks.length > 0 && (
                  <Pinyin
                    text={`${entry.reached ? "已解锁" : "解锁"} ${entry.unlocks
                      .map((u) => `${u.emoji ?? ""}${u.title}`)
                      .join("、")}`}
                  />
                )}
              </span>
            </div>
          ))}
        </section>
      )}
      </div>

      <KidNavBar
        compact
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          collectionNavItem(child.theme, slug),
        ]}
      />
    </>
  );
}
