import { PlantStatus } from "@/generated/prisma/client";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { GARDEN_HARVEST_MULTIPLIER, GARDEN_SET_SIZE, GARDEN_SIZE } from "@/lib/garden";

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
        就算集齐一整套，可以一次性收获换回<b>成本的 {GARDEN_HARVEST_MULTIPLIER} 倍</b>阳光，然后开始新一轮。
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
