import Link from "next/link";

import { RedemptionStatus } from "@/generated/prisma/client";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";
import { getOrCreateTodayTasks } from "@/lib/tasks";

export default async function AdminDashboardPage() {
  const child = await getPrimaryChild();

  const [tasks, balance, pendingRedemptions] = await Promise.all([
    getOrCreateTodayTasks(child.id),
    getPointsBalance(child.id),
    prisma.redemption.count({
      where: { childId: child.id, status: RedemptionStatus.REQUESTED },
    }),
  ]);

  const doneCount = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{child.name} 的仪表盘</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">今日任务完成</p>
          <p className="text-3xl font-bold">
            {doneCount} / {tasks.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">当前积分</p>
          <p className="text-3xl font-bold">{balance}</p>
        </div>
        <Link
          href="/admin/redemptions"
          className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-amber-50"
        >
          <p className="text-sm text-slate-500">待兑现的兑换申请</p>
          <p className={`text-3xl font-bold ${pendingRedemptions > 0 ? "text-amber-600" : ""}`}>
            {pendingRedemptions}
          </p>
        </Link>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">今日任务清单</h2>
        {tasks.length === 0 ? (
          <p className="text-slate-500">今天没有生成任何任务。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
                <span>
                  {task.emoji} {task.title}（{task.points} 分）
                </span>
                <span className={task.status === "DONE" ? "text-emerald-600" : "text-slate-400"}>
                  {task.status === "DONE" ? "已完成" : "未完成"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
