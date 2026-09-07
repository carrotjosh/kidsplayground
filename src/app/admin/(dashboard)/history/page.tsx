import { getPrimaryChild } from "@/lib/child";
import { formatStoredDate } from "@/lib/date";
import { prisma } from "@/lib/db";

import { approveAction, rejectAction, revokeAction } from "./actions";

export default async function HistoryPage() {
  const child = await getPrimaryChild();
  const tasks = await prisma.dailyTask.findMany({
    where: { childId: child.id },
    orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">打卡记录</h1>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-slate-500">还没有任何打卡记录。</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between pixel-card bg-white p-4"
            >
              <div>
                <p className="text-sm text-slate-400">
                  {formatStoredDate(task.date)} · {task.source === "TEMPLATE" ? "周期任务" : "临时任务"}
                  {task.status === "PENDING_REVIEW" && (
                    <span className="ml-2 font-semibold text-amber-600">⏳ 待审核</span>
                  )}
                </p>
                <p className="font-semibold">
                  {task.emoji} {task.title}（{task.points} 阳光）
                </p>
              </div>

              {task.status === "DONE" ? (
                <form action={revokeAction.bind(null, task.id)}>
                  <button
                    type="submit"
                    className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
                  >
                    撤销
                  </button>
                </form>
              ) : task.status === "PENDING_REVIEW" ? (
                <div className="flex gap-2">
                  <form action={approveAction.bind(null, task.id)}>
                    <button
                      type="submit"
                      className="pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
                    >
                      批准
                    </button>
                  </form>
                  <form action={rejectAction.bind(null, task.id)}>
                    <button
                      type="submit"
                      className="pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                    >
                      打回
                    </button>
                  </form>
                </div>
              ) : (
                <form action={approveAction.bind(null, task.id)}>
                  <button
                    type="submit"
                    className="pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
                  >
                    补打卡
                  </button>
                </form>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
