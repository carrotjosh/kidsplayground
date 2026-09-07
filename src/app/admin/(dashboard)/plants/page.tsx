import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { togglePlantTypeActiveAction } from "./actions";
import { PlantTypeForm } from "./PlantTypeForm";

export default async function PlantTypesAdminPage() {
  const child = await getPrimaryChild();
  const plantTypes = await prisma.plantType.findMany({
    where: { childId: child.id },
    orderBy: { cost: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">植物目录</h1>

      <PlantTypeForm />

      <div className="flex flex-col gap-3">
        {plantTypes.length === 0 ? (
          <p className="text-slate-500">还没有植物。</p>
        ) : (
          plantTypes.map((pt) => (
            <div
              key={pt.id}
              className="flex items-center justify-between pixel-card bg-white p-4"
            >
              <p className="font-semibold">
                {pt.emoji} {pt.title}（{pt.cost} 阳光）
              </p>
              <form action={togglePlantTypeActiveAction.bind(null, pt.id, !pt.active)}>
                <button
                  type="submit"
                  className={
                    pt.active
                      ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                      : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
                  }
                >
                  {pt.active ? "下架" : "上架"}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
