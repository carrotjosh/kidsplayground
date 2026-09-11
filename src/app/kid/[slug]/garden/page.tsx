import { notFound, redirect } from "next/navigation";

import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { PlantSprite } from "@/components/PlantSprite";
import { PointsBadge } from "@/components/PointsBadge";
import { ShopCard } from "@/components/ShopCard";
import { KidTheme, PlantStatus } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import {
  computeGardenProgress,
  GARDEN_COLS,
  GARDEN_SET_SIZE,
  GARDEN_SIZE,
  HARVEST_MAX_INTEREST_DAYS,
  getHarvestedRounds,
  settleGardenForChild,
} from "@/lib/garden";
import { getPointsBalance } from "@/lib/points";

import { harvestGardenAction, plantSeedAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function GardenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  // 主题互斥：图鉴主题的孩子不该看到花园，直接送回首页
  if (child.theme !== KidTheme.GARDEN) redirect(`/kid/${slug}`);

  // 懒结算：把欠下的僵尸判定补齐，返回这次新发生的事件用于一次性提示。
  const events = await settleGardenForChild(child.id);

  const [alivePlants, plantTypes, balance, harvestedRounds] = await Promise.all([
    prisma.plant.findMany({
      where: { childId: child.id, status: PlantStatus.ALIVE },
      // ledgerEntry / plantType 用来算收获奖励值多少（见 lib/garden.ts 的 computeHarvestBonus）
      include: { ledgerEntry: { select: { amount: true } }, plantType: { select: { cost: true } } },
    }),
    prisma.plantType.findMany({
      where: { childId: child.id, active: true },
      orderBy: { cost: "asc" },
    }),
    getPointsBalance(child.id),
    getHarvestedRounds(child.id),
  ]);

  const slotMap = new Map(alivePlants.map((p) => [p.slot, p]));
  const slots = Array.from({ length: GARDEN_SIZE }, (_, i) => slotMap.get(i) ?? null);
  const isFull = alivePlants.length >= GARDEN_SIZE;
  const progress = computeGardenProgress(plantTypes, alivePlants);
  const aliveByType = new Map(progress.entries.map((e) => [e.plantTypeId, e.alive]));

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-6 lg:p-8 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="我的花园" /> 🌻
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {events.length > 0 && (
        <section className="flex flex-col gap-2">
          {events.map((event, i) => (
            <p key={i} className="pixel-card kid-text bg-nes-red p-4 text-center text-white lg:p-5">
              {event.outcome === "GARDEN_EMPTY"
                ? `🧟 ${event.date}：任务没有全部完成，僵尸来过，还好花园是空的，扑了个空～`
                : event.shielded
                  ? `🧟 ${event.date}：任务没有全部完成，还好你刚种下的 ${event.plantEmoji ?? ""} ${event.plantTitle} 挡在最前面，替其它植物挨了一口！`
                  : `🧟 ${event.date}：任务没有全部完成，僵尸吃掉了你的 ${event.plantEmoji ?? ""} ${event.plantTitle}！`}
            </p>
          ))}
        </section>
      )}

      {/* 集卡进度：每种植物要种够 GARDEN_SET_SIZE 棵，集齐就能一次性收获换阳光 */}
      <section className="pixel-card flex flex-col gap-3 bg-white p-4 lg:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="kid-text text-lg text-slate-800 lg:text-xl">
            <Pinyin text={`每种植物种够 ${GARDEN_SET_SIZE} 棵，就能一次收获`} />{" "}
            <span className="text-amber-600">{progress.bonus}</span> ☀️
          </p>
          {harvestedRounds > 0 && (
            <p className="kid-text text-sm text-slate-500 lg:text-base">
              <Pinyin text={`已经收获过 ${harvestedRounds} 次`} /> 🏅
            </p>
          )}
        </div>

        {progress.entries.length === 0 ? (
          <p className="kid-text text-slate-500">
            <Pinyin text="还没有可以种的植物，等家长上架吧" />
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {progress.entries.map((entry, i) => (
              <span
                key={entry.plantTypeId}
                className={`pixel-border kid-text flex items-center gap-2 px-3 py-1.5 text-base lg:text-lg ${
                  entry.alive >= entry.needed
                    ? "bg-nes-green text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <PlantSprite
                  title={entry.title}
                  emoji={entry.emoji}
                  floatDelay={i * 0.3}
                  className="h-7 w-7 lg:h-8 lg:w-8"
                />
                {entry.alive} / {entry.needed}
                {entry.alive >= entry.needed && " ✅"}
              </span>
            ))}
          </div>
        )}

        {!progress.achievable && progress.entries.length > 0 && (
          <p className="kid-text text-sm text-nes-red">
            现在的花园装不下一整套（{progress.entries.length} 种 × {GARDEN_SET_SIZE} 棵
            {progress.strayAlive > 0 && ` + ${progress.strayAlive} 棵已下架的植物`} 超过了{" "}
            {GARDEN_SIZE} 个格子），请家长在「植物目录」里调整一下。
          </p>
        )}

        {/* 养得越久收获越多，孩子要看得见这件事，否则"种满就收"仍然是他的第一反应 */}
        {progress.spent > 0 && (
          <p className="kid-text text-sm text-slate-500 lg:text-base">
            <Pinyin
              text={
                progress.interestDays >= HARVEST_MAX_INTEREST_DAYS
                  ? `本金 ${progress.spent}，利息已经攒满啦，随时可以收`
                  : `本金 ${progress.spent}，平均养了 ${progress.interestDays} 天。养到 ${HARVEST_MAX_INTEREST_DAYS} 天利息最多，再等等更值哦`
              }
            />
          </p>
        )}

        {progress.complete && (
          <ConfirmActionButton
            action={harvestGardenAction.bind(null, slug)}
            confirmText={`花园集齐啦！收获后所有植物会被收走，换成 ${progress.bonus} 阳光（本金 ${progress.spent} + 养了 ${progress.interestDays} 天的利息），然后重新开始种。确定收获吗？`}
            label={`🎉 收获花园，换 ${progress.bonus} 阳光`}
            tone="gold"
          />
        )}
      </section>

      <section
        className="pixel-card grid gap-3 bg-white p-4 lg:p-6"
        style={{ gridTemplateColumns: `repeat(${GARDEN_COLS}, minmax(0, 1fr))` }}
      >
        {slots.map((plant, i) => (
          <div
            key={i}
            className="pixel-border flex aspect-square items-center justify-center bg-amber-100 p-1 text-3xl lg:text-5xl"
          >
            {plant ? (
              // floatDelay 按格子编号错开，十六棵植物就不会整整齐齐一起上下
              <PlantSprite
                title={plant.title}
                emoji={plant.emoji}
                floatDelay={(i % 6) * 0.4}
                className="h-full w-full"
              />
            ) : (
              "🟫"
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="pixel-text-outline kid-text text-lg text-white lg:text-xl">
          <Pinyin text="种点什么？" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plantTypes.length === 0 ? (
            <p className="pixel-card kid-text col-span-full bg-white p-6 text-center text-slate-500">
              <Pinyin text="还没有可以种的植物，等家长上架吧" />
            </p>
          ) : (
            plantTypes.map((pt, i) => {
              const enough = balance >= pt.cost;
              const setDone = (aliveByType.get(pt.id) ?? 0) >= GARDEN_SET_SIZE;
              const label = setDone
                ? `已种满 ${GARDEN_SET_SIZE} 棵`
                : isFull
                  ? "花园满了"
                  : enough
                    ? "种下 🌱"
                    : `还差 ${pt.cost - balance} 阳光`;

              return (
                <ShopCard
                  key={pt.id}
                  emoji={pt.emoji ?? "🌱"}
                  art={
                    <PlantSprite
                      title={pt.title}
                      emoji={pt.emoji}
                      floatDelay={i * 0.35}
                      className="h-full w-full"
                    />
                  }
                  title={pt.title}
                  cost={pt.cost}
                  note={`花园里 ${aliveByType.get(pt.id) ?? 0} / ${GARDEN_SET_SIZE} 棵`}
                >
                  <ConfirmActionButton
                    action={plantSeedAction.bind(null, slug, pt.id)}
                    confirmText={`确定用 ${pt.cost} 阳光种下${pt.title}吗？`}
                    disabled={!enough || isFull || setDone}
                    label={label}
                  />
                </ShopCard>
              );
            })
          )}
        </div>
      </section>

      <KidNavBar
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}/rewards`, label: "礼物商店", emoji: "🎁", tone: "pink" },
        ]}
      />
    </main>
  );
}
