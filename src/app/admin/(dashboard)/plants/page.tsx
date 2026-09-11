import { PlantSprite } from "@/components/PlantSprite";
import { PlantStatus } from "@/generated/prisma/client";
import { ensurePlantTypes } from "@/lib/bootstrap";
import { getPrimaryChild } from "@/lib/child";
import { formatStoredDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import { levelProgress, totalEarned } from "@/lib/level";
import {
  computeGardenProgress,
  getHarvestedRounds,
  getGardenRoadmap,
  GARDEN_STAGES,
  gardenSetSize,
  gardenSide,
  gardenSize,
  HARVEST_DAILY_INTEREST,
  HARVEST_MAX_INTEREST_DAYS,
  HARVEST_MAX_MULTIPLIER,
  GARDEN_STAGE_LEVELS,
} from "@/lib/garden";

import { PlantTypeForm } from "./PlantTypeForm";
import { PlantTypeRow } from "./PlantTypeRow";

export const dynamic = "force-dynamic";

export default async function PlantTypesAdminPage() {
  const child = await getPrimaryChild();
  // 分级功能上线前建的档案缺后面几级要用的品种，进这一页时补上（不上架，幂等）
  await ensurePlantTypes(child.id);

  const [plantTypes, aliveGroups, alivePlants, eaten, rounds, earned, roadmap, eatenCount] =
    await Promise.all([
      prisma.plantType.findMany({ where: { childId: child.id }, orderBy: { cost: "asc" } }),
      prisma.plant.groupBy({
        by: ["plantTypeId"],
        where: { childId: child.id, status: PlantStatus.ALIVE },
        _count: { _all: true },
      }),
      prisma.plant.findMany({
        where: { childId: child.id, status: PlantStatus.ALIVE },
        include: { ledgerEntry: { select: { amount: true } }, plantType: { select: { cost: true } } },
      }),
      prisma.plant.findMany({
        where: { childId: child.id, status: PlantStatus.EATEN },
        orderBy: { eatenOnDate: "desc" },
        take: 5,
      }),
      getHarvestedRounds(child.id),
      totalEarned(child.id),
      getGardenRoadmap(child.id, child.gardenStage),
      prisma.plant.count({ where: { childId: child.id, status: PlantStatus.EATEN } }),
    ]);

  const aliveByType = new Map(
    aliveGroups.map((g) => [g.plantTypeId, g._count._all] as const)
  );
  const activeCount = plantTypes.filter((pt) => pt.active).length;
  const setSize = gardenSetSize(child.gardenStage);
  const size = gardenSize(child.gardenStage);
  const maxTypes = Math.floor(size / setSize);

  const activeTypes = plantTypes
    .filter((pt) => pt.active)
    .map((pt) => ({ id: pt.id, title: pt.title, emoji: pt.emoji }));
  const garden = computeGardenProgress(child.gardenStage, activeTypes, alivePlants);
  const progress = levelProgress(child.level, earned);
  const nextStage = roadmap.find((r) => !r.reached);
  const side = gardenSide(child.gardenStage);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">植物目录</h1>

      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        现在是<b>第 {child.gardenStage} 级花园</b>（{size} 格）。孩子把
        <b>每种上架的植物都种够 {setSize} 棵</b>
        就算集齐一整套，可以一次性收获换成阳光，然后开始新一轮。
        <br />
        收获给多少<b>按每棵植物养了多少天算利息</b>：每天 {Math.round(HARVEST_DAILY_INTEREST * 100)}
        %，最多算 {HARVEST_MAX_INTEREST_DAYS} 天，也就是最高 {HARVEST_MAX_MULTIPLIER} 倍。
        当天种下当天收获没有利息（只拿回本金）——这样「种满就收、反复刷阳光」没有任何好处，
        孩子只能靠真的把植物养住来赚这份利息。
        <br />
        花园按<b>打卡等级</b>升级：格子多一圈，并自动上架一种新植物（一共{" "}
        {GARDEN_STAGES.length} 级，
        {GARDEN_STAGES.map((n, i) => `${n}×${n}(Lv.${GARDEN_STAGE_LEVELS[i]})`).join(" → ")}）。
        等级够了也要等孩子把当前这一园收获掉才会长大——不然刚集齐的一整套会当场变成没集齐。
        <b>升级时会自动帮你上架新品种，这一页不用手动改</b>——
        上架种类数必须正好等于当前级数要求的 {maxTypes} 种，多了少了孩子都集不齐。
        所以上架的种类最好正好 {maxTypes} 种
        {activeCount > maxTypes && (
          <span className="text-nes-red">
            ——现在上架了 {activeCount} 种，格子不够集齐一整套，请下架 {activeCount - maxTypes} 种。
          </span>
        )}
      </p>

      <PlantTypeForm />

      {/* ---- 孩子玩到哪了 ---- */}
      <div className="pixel-card flex flex-col gap-4 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{child.name} 的花园现状</h2>
          <span className="text-sm text-slate-500">
            Lv.{progress.level} {progress.title}
            {progress.next !== null && ` · 再挣 ${progress.remaining} 阳光升级`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="花园大小"
            value={`${side}×${side}`}
            sub={`第 ${child.gardenStage} 级 · ${size} 格`}
          />
          <Stat
            label="种着"
            value={`${alivePlants.length} 棵`}
            sub={garden.complete ? "已集齐，可以收获" : `离集齐还差 ${size - alivePlants.length} 棵`}
          />
          <Stat
            label="收获过"
            value={`${rounds} 轮`}
            sub={
              nextStage
                ? `Lv.${nextStage.needLevel} 升到 ${nextStage.side}×${nextStage.side}`
                : "已经是最大花园"
            }
          />
          <Stat
            label="被僵尸吃掉"
            value={`${eatenCount} 棵`}
            sub={eatenCount > 0 ? "任务没做完丢的" : "一棵都没丢过"}
          />
        </div>

        {/* 集卡进度，和孩子端看到的是同一份数据（computeGardenProgress） */}
        {garden.entries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {garden.entries.map((e) => (
              <span
                key={e.plantTypeId}
                className={`flex items-center gap-2 border-2 px-3 py-1.5 text-sm ${
                  e.alive >= e.needed
                    ? "border-nes-black bg-green-50 text-green-800"
                    : "border-slate-200 text-slate-600"
                }`}
              >
                <PlantSprite title={e.title} emoji={e.emoji} className="h-6 w-6" />
                {e.title} {e.alive}/{e.needed}
                {e.alive >= e.needed && " ✅"}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm text-slate-600">
          这一园本金 <b>{garden.spent}</b> 阳光，现在收获能拿 <b>{garden.bonus}</b>（平均养了{" "}
          {garden.interestDays} 天）。养到 {HARVEST_MAX_INTEREST_DAYS} 天利息封顶，
          最高 {HARVEST_MAX_MULTIPLIER} 倍。
        </p>

        {eaten.length > 0 && (
          <p className="text-sm text-slate-500">
            最近被吃掉的：
            {eaten
              .map(
                (p) =>
                  `${p.title}（${p.eatenOnDate ? formatStoredDate(p.eatenOnDate) : "—"}）`
              )
              .join("、")}
          </p>
        )}
      </div>

      <h2 className="font-semibold">植物目录</h2>

      <div className="flex flex-col gap-3">
        {plantTypes.length === 0 ? (
          <p className="text-slate-500">还没有植物。</p>
        ) : (
          plantTypes.map((pt) => (
            <PlantTypeRow
              key={pt.id}
              plantType={{
                id: pt.id,
                title: pt.title,
                cost: pt.cost,
                emoji: pt.emoji,
                active: pt.active,
              }}
              aliveCount={aliveByType.get(pt.id) ?? 0}
              setSize={setSize}
            />
          ))
        )}
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
