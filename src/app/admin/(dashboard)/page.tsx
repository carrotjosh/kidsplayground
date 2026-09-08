import Link from "next/link";

import { MonthStatsPanel, MonthTrend } from "@/components/MonthStatsPanel";
import { RedemptionStatus, TaskStatus } from "@/generated/prisma/client";
import { getMonthStats, getRecentMonthsStats } from "@/lib/analytics";
import { settleMonthlyBonusForChild } from "@/lib/calendar";
import { getPrimaryChild } from "@/lib/child";
import { currentMonthString, formatStoredDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";
import { getOrCreateTodayTasks } from "@/lib/tasks";

import { approveAction, rejectAction } from "./history/actions";

export default async function AdminDashboardPage() {
  const child = await getPrimaryChild();

  // 顺手结算月度满勤奖（幂等，重复调用不会重复发）。
  await settleMonthlyBonusForChild(child.id);

  const [tasks, balance, pendingRedemptions, pendingReviewTasks, stats, trend] = await Promise.all([
    getOrCreateTodayTasks(child.id),
    getPointsBalance(child.id),
    prisma.redemption.count({
      where: { childId: child.id, status: RedemptionStatus.REQUESTED },
    }),
    prisma.dailyTask.findMany({
      where: { childId: child.id, status: TaskStatus.PENDING_REVIEW },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    getMonthStats(child.id, currentMonthString()),
    getRecentMonthsStats(child.id, 6),
  ]);

  const doneCount = tasks.filter((t) => t.status === "DONE").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{child.name} 的仪表盘</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="pixel-card bg-white p-5">
          <p className="text-sm text-slate-500">今日任务完成</p>
          <p className="text-3xl font-bold">
            {doneCount} / {tasks.length}
          </p>
        </div>
        <div className="pixel-card bg-white p-5">
          <p className="text-sm text-slate-500">当前阳光</p>
          <p className="text-3xl font-bold">{balance}</p>
        </div>
        <Link
          href="/admin/redemptions"
          className="pixel-card bg-white p-5 transition hover:bg-amber-50"
        >
          <p className="text-sm text-slate-500">待兑现的兑换申请</p>
          <p className={`text-3xl font-bold ${pendingRedemptions > 0 ? "text-amber-600" : ""}`}>
            {pendingRedemptions}
          </p>
        </Link>
      </div>

      {pendingReviewTasks.length > 0 && (
        <div className="pixel-card bg-white p-5">
          <h2 className="mb-3 font-semibold text-amber-600">
            待审核任务（{pendingReviewTasks.length}）
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingReviewTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
                <span>
                  {formatStoredDate(task.date)} · {task.emoji} {task.title}（{task.points} 阳光）
                </span>
                <div className="flex gap-2">
                  <form action={approveAction.bind(null, task.id)}>
                    <button type="submit" className="pixel-btn bg-nes-green px-3 py-1 text-xs text-white">
                      批准
                    </button>
                  </form>
                  <form action={rejectAction.bind(null, task.id)}>
                    <button type="submit" className="pixel-btn bg-white px-3 py-1 text-xs text-slate-600">
                      打回
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 数据分析：本月达标率 + 阳光收支构成，再加最近半年的趋势。
          日历本身在"打卡记录"页，这里只放看趋势用的统计。 */}
      <MonthStatsPanel stats={stats} />
      <MonthTrend months={trend} />

      <Link href="/admin/history" className="text-sm text-slate-500 hover:text-slate-800">
        查看打卡日历和完整记录 →
      </Link>

      <div className="pixel-card bg-white p-5">
        <h2 className="mb-3 font-semibold">今日任务清单</h2>
        {tasks.length === 0 ? (
          <p className="text-slate-500">今天没有生成任何任务。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
                <span>
                  {task.emoji} {task.title}（{task.points} 阳光）
                </span>
                <span
                  className={
                    task.status === "DONE"
                      ? "text-emerald-600"
                      : task.status === "PENDING_REVIEW"
                        ? "text-amber-600"
                        : "text-slate-400"
                  }
                >
                  {task.status === "DONE" ? "已完成" : task.status === "PENDING_REVIEW" ? "待审核" : "未完成"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
