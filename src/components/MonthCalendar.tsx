import Link from "next/link";

import type { MonthSummary } from "@/lib/calendar";
import { addMonths, firstWeekdayOfMonth } from "@/lib/date";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 月历视图。每一格显示当天赚到的阳光：
 *   达标（≥ 每日达标线）→ 绿色；有任务但没达标 → 黄色；完全没打卡 → 灰色。
 * basePath 用来生成上/下个月的链接（月份通过 ?month= 查询参数传递）。
 */
export function MonthCalendar({
  summary,
  basePath,
}: {
  summary: MonthSummary;
  basePath: string;
}) {
  const { month, days, dailyGoalPoints } = summary;
  const leadingBlanks = firstWeekdayOfMonth(month);
  const [year, monthNum] = month.split("-");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`${basePath}?month=${addMonths(month, -1)}`}
          className="pixel-btn bg-white px-3 py-2 text-sm font-bold text-slate-700"
        >
          ← 上月
        </Link>
        <p className="text-lg font-bold text-slate-800">
          {year} 年 {Number(monthNum)} 月
        </p>
        <Link
          href={`${basePath}?month=${addMonths(month, 1)}`}
          className="pixel-btn bg-white px-3 py-2 text-sm font-bold text-slate-700"
        >
          下月 →
        </Link>
      </div>

      <div className="pixel-card bg-white p-3 lg:p-5">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 lg:gap-2">
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const dayNum = Number(day.date.slice(-2));
            const tone = day.isFuture
              ? "border-slate-200 bg-white text-slate-300"
              : day.reachedGoal
                ? "border-nes-black bg-nes-green text-white"
                : day.hasTasks
                  ? "border-nes-black bg-nes-yellow text-nes-black"
                  : "border-slate-300 bg-slate-200 text-slate-400";

            return (
              <div
                key={day.date}
                className={`flex aspect-square flex-col items-center justify-center border-2 ${tone}`}
                title={
                  day.hasTasks
                    ? `${day.date}：完成 ${day.doneTasks}/${day.totalTasks} 个任务，获得 ${day.earned} 阳光`
                    : `${day.date}：没有任务`
                }
              >
                <span className="text-xs font-bold leading-none lg:text-sm">{dayNum}</span>
                {!day.isFuture && day.earned > 0 && (
                  <span className="mt-0.5 text-[10px] font-bold leading-none lg:text-xs">
                    {day.earned}☀️
                  </span>
                )}
                {day.planted && <span className="text-[9px] leading-none lg:text-xs">🌱</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-nes-black bg-nes-green" />
          达标（≥{dailyGoalPoints} 阳光）
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-nes-black bg-nes-yellow" />
          有任务但没达标
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-slate-300 bg-slate-200" />
          没有打卡
        </span>
        <span>🌱 当天种了植物（免疫僵尸）</span>
      </div>
    </div>
  );
}

/** 月度进度条 + 满勤奖状态，孩子端和家长端共用。 */
export function MonthProgress({ summary }: { summary: MonthSummary }) {
  const { taskDays, reachedDays, monthEarned, bonusRatio, onTrackForBonus, bonusGranted } = summary;
  const needed = taskDays > 0 ? Math.ceil(taskDays * bonusRatio) : 0;

  return (
    <div className="pixel-card flex flex-col gap-2 bg-white p-4 lg:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold text-slate-800">本月成绩单</p>
        <p className="text-sm text-slate-600">
          共获得 <span className="font-bold text-amber-600">{monthEarned}</span> 阳光
        </p>
      </div>

      {taskDays === 0 ? (
        <p className="text-sm text-slate-500">这个月还没有安排任务。</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            达标 <span className="font-bold text-nes-green">{reachedDays}</span> / {taskDays} 天，
            满勤奖需要至少 {needed} 天
          </p>
          <div className="h-3 w-full border-2 border-nes-black bg-slate-100">
            <div
              className="h-full bg-nes-green"
              style={{ width: `${Math.min(100, (reachedDays / taskDays) * 100)}%` }}
            />
          </div>
          <p className="text-sm font-bold">
            {bonusGranted
              ? "🏅 满勤奖 +100 阳光已发放！"
              : onTrackForBonus
                ? "🎉 已经达到满勤线，月底自动发 100 阳光！"
                : `还差 ${needed - reachedDays} 天达标就能拿满勤奖 🏅`}
          </p>
        </>
      )}
    </div>
  );
}
