import Link from "next/link";

import type { MonthSummary } from "@/lib/calendar";
import { addMonths, firstWeekdayOfMonth } from "@/lib/date";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 翻月控件（上月 / 年月 / 下月）。单独导出，是为了让孩子端能把它放进栏目标题那一行，
 * 这样左右两栏的第一行高度一致、日历顶边和任务卡顶边能对齐。
 */
export function MonthNav({
  month,
  basePath,
  big = false,
}: {
  month: string;
  basePath: string;
  big?: boolean;
}) {
  const [year, monthNum] = month.split("-");
  const btn = `pixel-btn kid-text bg-white text-slate-700 ${
    big ? "px-3 py-1 text-lg lg:text-xl" : "px-3 py-1 text-sm"
  }`;

  return (
    <div className="flex items-center gap-2">
      <Link href={`${basePath}?month=${addMonths(month, -1)}`} className={btn} aria-label="上个月">
        ←
      </Link>
      <p
        className={`whitespace-nowrap text-white pixel-text-outline ${
          big ? "text-lg lg:text-2xl" : "text-base font-bold"
        }`}
      >
        {year} 年 {Number(monthNum)} 月
      </p>
      <Link href={`${basePath}?month=${addMonths(month, 1)}`} className={btn} aria-label="下个月">
        →
      </Link>
    </div>
  );
}

/**
 * 月历视图。格子底色表示打卡结果，右上角小角标表示日子类型（法定节假日/调休上学）：
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
  dayHref,
  selectedDate = null,
}: {
  summary: MonthSummary;
  basePath: string | null;
  big?: boolean;
  fitHeight?: boolean;
  /**
   * 传了就把每个"已经过去/今天"的格子变成链接。用回调而不是拼字符串前缀，
   * 是因为两边要的链接形状不一样：孩子端进子路由看当天详情，
   * 家长端是在同一页加 ?day= 参数选中那天补打卡。
   */
  dayHref?: (date: string) => string;
  /** 高亮某一天（家长端用来标出"当前选中要补打卡的日子"）。 */
  selectedDate?: string | null;
}) {
  const { month, days, dailyGoalPoints } = summary;
  const leadingBlanks = firstWeekdayOfMonth(month);
  const [year, monthNum] = month.split("-");
  const rowCount = Math.ceil((leadingBlanks + days.length) / 7);

  return (
    <div className={`flex flex-col gap-2 ${fitHeight ? "h-full" : ""}`}>
      {/* basePath 为 null 表示调用方（比如孩子端首页）已经把 MonthNav 放进自己的栏目标题行了，
          这里就整行都不渲染，省下一行高度、也避免年月重复出现两次。 */}
      {basePath && (
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`${basePath}?month=${addMonths(month, -1)}`}
            className={`pixel-btn kid-text bg-white text-slate-700 ${
              big ? "px-5 py-2 text-xl lg:text-2xl" : "px-3 py-2 text-sm"
            }`}
          >
            ← 上月
          </Link>
          <p className={`text-slate-800 ${big ? "text-xl lg:text-2xl" : "text-lg font-bold"}`}>
            {year} 年 {Number(monthNum)} 月
          </p>
          <Link
            href={`${basePath}?month=${addMonths(month, 1)}`}
            className={`pixel-btn kid-text bg-white text-slate-700 ${
              big ? "px-5 py-2 text-xl lg:text-2xl" : "px-3 py-2 text-sm"
            }`}
          >
            下月 →
          </Link>
        </div>
      )}

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

            // 休息日 = 法定节假日 + 普通双休日，两者都标「休」，
            // 只是法定节假日底色更深一点，好和普通周末区分。
            const isRestDay = day.dayType === "HOLIDAY" || day.dayType === "WEEKEND";
            const restTone =
              day.dayType === "HOLIDAY"
                ? "border-rose-300 bg-rose-100 text-rose-500"
                : "border-rose-200 bg-rose-50 text-rose-400";

            // 底色：先看打卡结果，没结果的日子再退回按"日子类型"上底色，
            // 这样休息日一眼能看出来，不会和"该打卡却没打"混淆。
            const tone = day.isFuture
              ? isRestDay
                ? restTone
                : "border-slate-200 bg-white text-slate-300"
              : day.reachedGoal
                ? "border-nes-black bg-nes-green text-white"
                : day.hasTasks
                  ? "border-nes-black bg-nes-yellow text-nes-black"
                  : isRestDay
                    ? restTone
                    : "border-slate-300 bg-slate-100 text-slate-400";

            const title = [
              day.date,
              day.holidayName ? `（${day.holidayName}）` : "",
              day.dayType === "WORKDAY" ? "· 工作日" : day.dayType === "WEEKEND" ? "· 周末" : "",
              day.hasTasks
                ? `· 完成 ${day.doneTasks}/${day.totalTasks} 个任务，获得 ${day.earned} 阳光`
                : "· 没有任务",
            ].join(" ");

            // 未来的日子还没发生，点进去没东西看，就不做成链接。
            const href = dayHref && !day.isFuture ? dayHref(day.date) : null;
            const isSelected = selectedDate === day.date;
            const cellClass = `relative flex flex-col items-center justify-center border-2 ${tone} ${
              fitHeight ? "" : "aspect-square"
            } ${href ? "cursor-pointer transition-transform hover:z-10 hover:scale-105" : ""} ${
              // 用 ring 而不是改 border：border 会挤动内容，ring 画在外面不影响布局
              isSelected ? "z-10 ring-4 ring-nes-red" : ""
            }`;

            const body = (
              <>
                {/* 右上角角标：休息日（法定节假日 + 双休日）标"休"，调休上学的周末标"学" */}
                {isRestDay && (
                  <span
                    className={`absolute right-0.5 top-0 text-[9px] leading-tight lg:text-xs ${
                      day.dayType === "HOLIDAY" ? "text-nes-red" : "text-rose-400"
                    }`}
                  >
                    休
                  </span>
                )}
                {day.isMakeupWorkday && (
                  <span className="absolute right-0.5 top-0 text-[9px] leading-tight text-slate-500 lg:text-xs">
                    学
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
              </>
            );

            // Link 和 div 的 props 类型对不上，没法用同一个变量当组件名，就直接分支渲染。
            return href ? (
              <Link key={day.date} href={href} className={cellClass} title={title}>
                {body}
              </Link>
            ) : (
              <div key={day.date} className={cellClass} title={title}>
                {body}
              </div>
            );
          })}
        </div>
      </div>

      {/* 图例：孩子端放大到能看清（big），并且用白底卡片和蓝色背景拉开对比 */}
      <div
        className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${
          big
            ? "pixel-border bg-white px-3 py-1.5 text-sm text-slate-700 lg:text-base"
            : "text-xs text-slate-600"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <i
            className={`inline-block border-2 border-nes-black bg-nes-green ${big ? "h-4 w-4" : "h-3 w-3"}`}
          />
          达标（≥{dailyGoalPoints} 阳光）
        </span>
        <span className="flex items-center gap-1.5">
          <i
            className={`inline-block border-2 border-nes-black bg-nes-yellow ${big ? "h-4 w-4" : "h-3 w-3"}`}
          />
          没达标
        </span>
        <span className="flex items-center gap-1.5">
          <i
            className={`inline-block border-2 border-rose-300 bg-rose-100 ${big ? "h-4 w-4" : "h-3 w-3"}`}
          />
          节假日
        </span>
        <span className="flex items-center gap-1.5">
          <i
            className={`inline-block border-2 border-rose-200 bg-rose-50 ${big ? "h-4 w-4" : "h-3 w-3"}`}
          />
          双休日
        </span>
        <span>
          <b className="text-nes-red">休</b> = 休息 · <b>学</b> = 调休上学
        </span>
        <span>🌱 种了植物</span>
      </div>
    </div>
  );
}

/** 月度进度条 + 满勤奖状态，孩子端和家长端共用。 */
export function MonthProgress({ summary }: { summary: MonthSummary }) {
  const { taskDays, reachedDays, remainingDays, monthEarned, bonusRatio, onTrackForBonus, bonusGranted } =
    summary;
  const needed = taskDays > 0 ? Math.ceil(taskDays * bonusRatio) : 0;
  // 剩下的日子全部达标也够不到满勤线，就别再显示"还差 N 天"吊着了
  const stillPossible = reachedDays + remainingDays >= needed;

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
            本月该打卡 {taskDays} 天，已达标{" "}
            <span className="font-bold text-nes-green">{reachedDays}</span> 天，满勤奖需要至少{" "}
            {needed} 天
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
                : stillPossible
                  ? `还要再达标 ${needed - reachedDays} 天就能拿满勤奖 🏅`
                  : "这个月的满勤奖够不到了，下个月重新开始 💪"}
          </p>
        </>
      )}
    </div>
  );
}
