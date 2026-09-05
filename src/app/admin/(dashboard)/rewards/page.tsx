import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { toggleRewardActiveAction } from "./actions";
import { RewardForm } from "./RewardForm";

export default async function RewardsAdminPage() {
  const child = await getPrimaryChild();
  const rewards = await prisma.reward.findMany({
    where: { childId: child.id },
    orderBy: { cost: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">礼物清单</h1>

      <RewardForm />

      <div className="flex flex-col gap-3">
        {rewards.length === 0 ? (
          <p className="text-slate-500">还没有礼物。</p>
        ) : (
          rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex items-center justify-between pixel-card bg-white p-4"
            >
              <p className="font-semibold">
                {reward.emoji} {reward.title}（{reward.cost} 分）
              </p>
              <form action={toggleRewardActiveAction.bind(null, reward.id, !reward.active)}>
                <button
                  type="submit"
                  className={
                    reward.active
                      ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                      : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
                  }
                >
                  {reward.active ? "下架" : "上架"}
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
