import { PlantStatus } from "@/generated/prisma/client";
import { ensurePlantTypes } from "@/lib/bootstrap";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import {
  GARDEN_STAGES,
  gardenSetSize,
  gardenSize,
  HARVEST_DAILY_INTEREST,
  HARVEST_MAX_INTEREST_DAYS,
  HARVEST_MAX_MULTIPLIER,
  HARVEST_ROUNDS_PER_STAGE,
} from "@/lib/garden";

import { PlantTypeForm } from "./PlantTypeForm";
import { PlantTypeRow } from "./PlantTypeRow";

export const dynamic = "force-dynamic";

export default async function PlantTypesAdminPage() {
  const child = await getPrimaryChild();
  // 分级功能上线前建的档案缺后面几级要用的品种，进这一页时补上（不上架，幂等）
  await ensurePlantTypes(child.id);

  const [plantTypes, aliveGroups] = await Promise.all([
    prisma.plantType.findMany({ where: { childId: child.id }, orderBy: { cost: "asc" } }),
    prisma.plant.groupBy({
      by: ["plantTypeId"],
      where: { childId: child.id, status: PlantStatus.ALIVE },
      _count: { _all: true },
    }),
  ]);

  const aliveByType = new Map(
    aliveGroups.map((g) => [g.plantTypeId, g._count._all] as const)
  );
  const activeCount = plantTypes.filter((pt) => pt.active).length;
  const setSize = gardenSetSize(child.gardenStage);
  const size = gardenSize(child.gardenStage);
  const maxTypes = Math.floor(size / setSize);

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
        每收获 <b>{HARVEST_ROUNDS_PER_STAGE} 轮</b>花园升一级：格子多一圈，
        并自动上架一种新植物（一共 {GARDEN_STAGES.length} 级，
        {GARDEN_STAGES.map((n) => `${n}×${n}`).join(" → ")}）。
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
