import { MonthCalendar, MonthProgress } from "@/components/MonthCalendar";
import { getMonthSummary, settleMonthlyBonusForChild } from "@/lib/calendar";
import { getPrimaryChild } from "@/lib/child";
import {
  currentMonthString,
  dateStringToUtcDate,
  datesInMonth,
  formatDateWithWeekday,
  formatStoredDate,
  isValidMonthString,
  todayDateString,
} from "@/lib/date";
import { prisma } from "@/lib/db";
import { ensureDailyTasksForDate } from "@/lib/tasks";

import { approveAction, rejectAction, revokeAction } from "./actions";
import { MakeupDatePicker } from "./MakeupDatePicker";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const { month: monthParam, day: dayParam } = await searchParams;
  const today = todayDateString();
  // 只允许补打卡到今天为止，未来的日期没有意义
  const day = dayParam && ISO_DATE.test(dayParam) && dayParam <= today ? dayParam : null;
  // 选了某一天就把日历也切到那个月，视觉上对得上
  const month = day
    ? day.slice(0, 7)
    : monthParam && isValidMonthString(monthParam)
      ? monthParam
      : currentMonthString();

  const child = await getPrimaryChild();

  // 顺手把欠着的月度满勤奖结算掉（幂等，重复调用不会重复发）。
  await settleMonthlyBonusForChild(child);

  // 选了具体某天：先把那天该有的模板任务补生成出来，否则"从没打开过 App 的日子"
  // 会是一片空白，家长根本没有可补打卡的条目。
  if (day) {
    await ensureDailyTasksForDate(prisma, child.id, day);
  }

  const dates = datesInMonth(month);
  const [summary, tasks, dayTasks] = await Promise.all([
    getMonthSummary(child, month),
    prisma.dailyTask.findMany({
      where: {
        childId: child.id,
        date: {
          gte: dateStringToUtcDate(dates[0]),
          lte: dateStringToUtcDate(dates[dates.length - 1]),
        },
      },
      orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    }),
    day
      ? prisma.dailyTask.findMany({
          where: { childId: child.id, date: dateStringToUtcDate(day) },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">打卡记录</h1>

      {/* 日历就是补打卡的入口：点任意一个已过去的日子，下面的面板就切到那天。
          带上 #makeup 锚点，点完自动滚到面板，不用自己找。 */}
      <MonthCalendar
        summary={summary}
        basePath="/admin/history"
        dayHref={(d) => `/admin/history?month=${month}&day=${d}#makeup`}
        selectedDate={day}
      />

      <div id="makeup" className="pixel-card flex flex-col gap-3 bg-white p-5">
        <h2 className="font-semibold">补打卡</h2>
        <p className="text-sm text-slate-500">
          <b>直接点上面日历里的某一天</b>，就能把那天漏掉的任务补上；也可以用下面的日期框跳到更早的月份。
          那天如果从来没生成过任务，这里会按模板自动补出来。
        </p>
        <MakeupDatePicker value={day ?? today} max={today} />

        {day && (
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <p className="text-sm font-semibold">
              {formatDateWithWeekday(day)}
              {day === today && <span className="ml-2 text-xs text-slate-400">（今天）</span>}
            </p>
            {dayTasks.length === 0 ? (
              <p className="text-sm text-slate-500">这天没有任何任务（也没有模板在这天生效）。</p>
            ) : (
              dayTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 border-2 border-slate-200 p-3"
                >
                  <span className="text-sm">
                    {task.emoji} {task.title}（{task.points} 阳光）
                    {task.status === "DONE" && (
                      <span className="ml-2 text-xs text-emerald-600">已完成</span>
                    )}
                    {task.status === "PENDING_REVIEW" && (
                      <span className="ml-2 text-xs text-amber-600">待审核</span>
                    )}
                  </span>
                  {task.status === "DONE" ? (
                    <form action={revokeAction.bind(null, task.id)}>
                      <button
                        type="submit"
                        className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
                      >
                        撤销
                      </button>
                    </form>
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
        )}
      </div>

      <MonthProgress summary={summary} />

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">本月任务明细</h2>
        {tasks.length === 0 ? (
          <p className="text-slate-500">这个月还没有任何打卡记录。</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between pixel-card bg-white p-4"
            >
              <div>
                <p className="text-sm text-slate-400">
                  {formatStoredDate(task.date)} ·{" "}
                  {task.source === "TEMPLATE" ? "周期任务" : "临时任务"}
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
