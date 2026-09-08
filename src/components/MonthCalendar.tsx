import Link from "next/link";

import type { MonthSummary } from "@/lib/calendar";
import { addMonths, firstWeekdayOfMonth } from "@/lib/date";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 月历视图。格子底色表示打卡结果，右上角小角标表示日子类型（法定节假日/调休补班）：
 *   达标（≥ 每日达标线）→ 绿色；有任务但没达标 → 黄色；有任务日没打卡 → 灰色。
 * basePath 用来生成上/下个月的链接（月份通过 ?month= 查询参数传递），传 null 就不显示翻月按钮。
 * big：孩子端用的放大版（日期和阳光数字都更大）。
 * fitHeight：把日历撑满父容器剩余高度（左右分栏时用），格子不再是正方形而是按可用高度均分行。
 */
export function MonthCalendar({
  summary,
  basePath,
  big = false,
  fitHeight = false,
}: {
  summary: MonthSummary;
  basePath: string | null;
  big?: boolean;
  fitHeight?: boolean;
}) {
  const { month, days, dailyGoalPoints } = summary;
  const leadingBlanks = firstWeekdayOfMonth(month);
  const [year, monthNum] = month.split("-");
  const rowCount = Math.ceil((leadingBlanks + days.length) / 7);

  return (
    <div className={`flex flex-col gap-2 ${fitHeight ? "h-full" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        {basePath ? (
          <Link
            href={`${basePath}?month=${addMonths(month, -1)}`}
            className="pixel-btn bg-white px-3 py-2 text-sm text-slate-700"
          >
            ← 上月
          </Link>
        ) : (
          <span />
        )}
        <p className={`text-slate-800 ${big ? "text-xl lg:text-2xl" : "text-lg font-bold"}`}>
          {year} 年 {Number(monthNum)} 月
        </p>
        {basePath ? (
          <Link
            href={`${basePath}?month=${addMonths(month, 1)}`}
            className="pixel-btn bg-white px-3 py-2 text-sm text-slate-700"
          >
            下月 →
          </Link>
        ) : (
          <span />
        )}
      </div>

      <div
        className={`pixel-card flex flex-col bg-white p-2 lg:p-3 ${
          fitHeight ? "min-h-0 flex-1" : ""
        }`}
      >
        <div
          className={`mb-1 grid shrink-0 grid-cols-7 gap-1 text-center text-slate-500 ${
            big ? "text-sm lg:text-base" : "text-xs"
          }`}
        >
          {WEEKDAY_LABELS.map((label, i) => (
            // 周六周日的表头标成红色，和下方节假日底色呼应
            <div key={label} className={i === 0 || i === 6 ? "text-nes-red" : ""}>
              {label}
            </div>
          ))}
        </div>

        <div
          className={`grid grid-cols-7 gap-1 ${fitHeight ? "min-h-0 flex-1" : ""}`}
          style={
            fitHeight ? { gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` } : undefined
          }
        >
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const dayNum = Number(day.date.slice(-2));

            // 底色：先看打卡结果，没结果的日子再退回按"日子类型"上底色，
            // 这样节假日一眼能看出来，不会和"没打卡"混淆。
            const tone = day.isFuture
              ? day.dayType === "HOLIDAY"
                ? "border-rose-200 bg-rose-50 text-rose-400"
                : "border-slate-200 bg-white text-slate-300"
              : day.reachedGoal
                ? "border-nes-black bg-nes-green text-white"
                : day.hasTasks
                  ? "border-nes-black bg-nes-yellow text-nes-black"
                  : day.dayType === "HOLIDAY"
                    ? "border-rose-300 bg-rose-100 text-rose-500"
                    : "border-slate-300 bg-slate-100 text-slate-400";

            const title = [
              day.date,
              day.holidayName ? `（${day.holidayName}）` : "",
              day.dayType === "WORKDAY" ? "· 工作日" : day.dayType === "WEEKEND" ? "· 周末" : "",
              day.hasTasks
                ? `· 完成 ${day.doneTasks}/${day.totalTasks} 个任务，获得 ${day.earned} 阳光`
                : "· 没有任务",
            ].join(" ");

            return (
              <div
                key={day.date}
                className={`relative flex flex-col items-center justify-center border-2 ${tone} ${
                  fitHeight ? "" : "aspect-square"
                }`}
                title={title}
              >
                {/* 右上角角标：法定节假日标"休"，调休补班的周末标"班" */}
                {day.dayType === "HOLIDAY" && (
                  <span className="absolute right-0.5 top-0 text-[9px] leading-tight text-nes-red lg:text-xs">
                    休
                  </span>
                )}
                {day.isMakeupWorkday && (
                  <span className="absolute right-0.5 top-0 text-[9px] leading-tight text-slate-500 lg:text-xs">
                    班
                  </span>
                )}

                <span className={big ? "text-xl leading-none lg:text-2xl" : "text-sm leading-none"}>
                  {dayNum}
                </span>
                {!day.isFuture && day.earned > 0 && (
                  <span
                    className={`mt-1 leading-none ${big ? "text-sm lg:text-lg" : "text-[11px]"}`}
                  >
                    {day.earned}☀️
                  </span>
                )}
                {day.planted && (
                  <span className={`leading-none ${big ? "text-sm" : "text-[9px]"}`}>🌱</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-nes-black bg-nes-green" />
          达标（≥{dailyGoalPoints} 阳光）
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-nes-black bg-nes-yellow" />
          没达标
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 border-2 border-rose-300 bg-rose-100" />
          法定节假日「休」
        </span>
        <span>「班」= 调休补班</span>
        <span>🌱 当天种了植物</span>
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
