import { PlantStatus } from "@/generated/prisma/client";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import {
  GARDEN_SET_SIZE,
  GARDEN_SIZE,
  HARVEST_DAILY_INTEREST,
  HARVEST_MAX_INTEREST_DAYS,
  HARVEST_MAX_MULTIPLIER,
} from "@/lib/garden";

import { PlantTypeForm } from "./PlantTypeForm";
import { PlantTypeRow } from "./PlantTypeRow";

export const dynamic = "force-dynamic";

export default async function PlantTypesAdminPage() {
  const child = await getPrimaryChild();
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
  const maxTypes = Math.floor(GARDEN_SIZE / GARDEN_SET_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">植物目录</h1>

      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        花园是 {GARDEN_SIZE} 格。孩子把<b>每种上架的植物都种够 {GARDEN_SET_SIZE} 棵</b>
        就算集齐一整套，可以一次性收获换成阳光，然后开始新一轮。
        <br />
        收获给多少<b>按每棵植物养了多少天算利息</b>：每天 {Math.round(HARVEST_DAILY_INTEREST * 100)}
        %，最多算 {HARVEST_MAX_INTEREST_DAYS} 天，也就是最高 {HARVEST_MAX_MULTIPLIER} 倍。
        当天种下当天收获没有利息（只拿回本金）——这样「种满就收、反复刷阳光」没有任何好处，
        孩子只能靠真的把植物养住来赚这份利息。
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
              setSize={GARDEN_SET_SIZE}
            />
          ))
        )}
      </div>
    </div>
  );
}
