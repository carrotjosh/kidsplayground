import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { fulfillAction } from "./actions";

export default async function RedemptionsPage() {
  const child = await getPrimaryChild();
  const redemptions = await prisma.redemption.findMany({
    where: { childId: child.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">兑换记录</h1>

      <div className="flex flex-col gap-2">
        {redemptions.length === 0 ? (
          <p className="text-slate-500">还没有兑换申请。</p>
        ) : (
          redemptions.map((redemption) => (
            <div
              key={redemption.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div>
                <p className="text-sm text-slate-400">
                  {redemption.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                </p>
                <p className="font-semibold">
                  {redemption.rewardTitle}（{redemption.cost} 分）
                </p>
              </div>

              {redemption.status === "REQUESTED" ? (
                <form action={fulfillAction.bind(null, redemption.id)}>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-3 py-1 text-sm text-white"
                  >
                    标记已兑现
                  </button>
                </form>
              ) : (
                <span className="rounded-lg bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
                  已兑现
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
