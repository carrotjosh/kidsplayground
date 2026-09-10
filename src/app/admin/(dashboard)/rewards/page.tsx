import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { RewardForm } from "./RewardForm";
import { RewardRow } from "./RewardRow";

export default async function RewardsAdminPage() {
  const child = await getPrimaryChild();
  const rewards = await prisma.reward.findMany({
    where: { childId: child.id },
    orderBy: { cost: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">礼物商店</h1>

      <RewardForm />

      <div className="flex flex-col gap-3">
        {rewards.length === 0 ? (
          <p className="text-slate-500">还没有礼物。</p>
        ) : (
          rewards.map((reward) => (
            <RewardRow
              key={reward.id}
              reward={{
                id: reward.id,
                title: reward.title,
                cost: reward.cost,
                emoji: reward.emoji,
                cooldownDays: reward.cooldownDays,
                active: reward.active,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
