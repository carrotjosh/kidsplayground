import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";

import { AdjustPointsForm } from "./AdjustPointsForm";

const TYPE_LABELS: Record<string, string> = {
  TASK_COMPLETE: "完成任务",
  REDEMPTION: "兑换礼物",
  MANUAL_ADJUST: "手动调整",
  TASK_REVOKE: "撤销打卡",
  PLANT_SEED: "种植物",
};

export default async function PointsPage() {
  const child = await getPrimaryChild();
  const [entries, balance] = await Promise.all([
    prisma.pointsLedger.findMany({
      where: { childId: child.id },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getPointsBalance(child.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">阳光记录</h1>
        <p className="text-2xl font-bold text-amber-600">当前余额：{balance}</p>
      </div>

      <AdjustPointsForm />

      <div className="flex flex-col gap-2">
        {entries.length === 0 ? (
          <p className="text-slate-500">还没有阳光流水。</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between pixel-card bg-white p-4"
            >
              <div>
                <p className="text-sm text-slate-400">
                  {entry.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} ·{" "}
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </p>
                <p className="font-semibold">{entry.reason}</p>
              </div>
              <p
                className={`text-xl font-bold ${
                  entry.amount >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {entry.amount >= 0 ? "+" : ""}
                {entry.amount}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
