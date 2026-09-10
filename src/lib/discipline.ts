import { TaskStatus } from "@/generated/prisma/client";
import { addDays, addMonths, currentMonthString, formatStoredDate, todayDateString } from "@/lib/date";
import { dateStringToUtcDate } from "@/lib/date";
import { prisma } from "@/lib/db";

/**
 * 自觉性观测。
 *
 * 这套系统的终点是**孩子不再需要它**。但原来的数据里没有任何东西能回答
 * "他现在还需要吗"——只有阳光余额和打卡记录，那些讲的是奖励，不是习惯。
 *
 * 这里算三个能反映行为本身的指标，给家长判断什么时候该提高门槛、什么时候可以退出。
 * 不做任何自动调整：把奖励密度调低是教育决策，不该由代码替家长做。
 */

/** 观测窗口。三个月够看出趋势，又不至于被半年前的表现拖住。 */
const WINDOW_DAYS = 90;

/** 趋势看几个月。 */
const TREND_MONTHS = 6;

export type DisciplineStats = {
  /** 窗口内应该有任务的天数 */
  activeDays: number;
  /** 其中达标的天数 */
  reachedDays: number;
  /** 当前连续达标天数（截到昨天，今天还没过完不算） */
  currentStreak: number;
  /** 窗口内最长的连续达标 */
  longestStreak: number;
  /**
   * 自觉提交率：完成的任务里，有多少是孩子**当天自己**点的"我完成了"，
   * 而不是家长事后补批的。null 表示窗口内还没有带 submittedAt 的数据
   * （这个字段是后加的，老记录一律为空，不回填假数据）。
   */
  selfReportRate: number | null;
  /** 分母，用于在界面上说明样本量 */
  completedTasks: number;
  /** 近 6 个月的月达标率，用来画趋势 */
  trend: { month: string; rate: number | null }[];
  /** 一句人话结论 */
  verdict: string;
};

export async function getDisciplineStats(
  childId: string,
  dailyGoalPoints: number
): Promise<DisciplineStats> {
  const today = todayDateString();
  const windowStart = addDays(today, -WINDOW_DAYS);
  // 趋势要往前多取几个月，所以查询窗口按两者里更早的那个来
  const trendStart = `${addMonths(currentMonthString(), -(TREND_MONTHS - 1))}-01`;
  const from = trendStart < windowStart ? trendStart : windowStart;

  const tasks = await prisma.dailyTask.findMany({
    where: {
      childId,
      date: { gte: dateStringToUtcDate(from), lte: dateStringToUtcDate(today) },
      status: { not: TaskStatus.CANCELLED },
    },
    select: { date: true, status: true, points: true, submittedAt: true },
  });

  // 按日期汇总：那天挣了多少、有没有任务
  const earnedByDate = new Map<string, number>();
  const datesWithTasks = new Set<string>();
  let completedTasks = 0;
  let selfReported = 0;
  let hasSubmittedData = false;

  for (const task of tasks) {
    const date = formatStoredDate(task.date);
    datesWithTasks.add(date);
    if (task.status !== TaskStatus.DONE) continue;
    earnedByDate.set(date, (earnedByDate.get(date) ?? 0) + task.points);

    // 自觉提交率只统计观测窗口内的，趋势那几个月不掺进来
    if (date < windowStart) continue;
    completedTasks += 1;
    if (task.submittedAt) {
      hasSubmittedData = true;
      // 孩子当天点的才算自觉。第二天补点的、以及家长直接补批（submittedAt 为空）的都不算。
      if (todayDateString(task.submittedAt) === date) selfReported += 1;
    }
  }

  const reached = (date: string) => (earnedByDate.get(date) ?? 0) >= dailyGoalPoints;

  // ---- 窗口内的达标天数 ----
  let activeDays = 0;
  let reachedDays = 0;
  for (let d = windowStart; d <= today; d = addDays(d, 1)) {
    if (!datesWithTasks.has(d)) continue;
    activeDays += 1;
    if (reached(d)) reachedDays += 1;
  }

  // ---- 连续达标 ----
  // 只在"有任务的日子"上连：周末没排任务不该把连击断掉。
  const activeDates = [...datesWithTasks].filter((d) => d >= windowStart && d <= today).sort();
  let longestStreak = 0;
  let run = 0;
  for (const d of activeDates) {
    if (reached(d)) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }
  // 当前连击从昨天往回数——今天还没过完，没达标不代表断了
  let currentStreak = 0;
  for (let i = activeDates.length - 1; i >= 0; i--) {
    const d = activeDates[i];
    if (d === today) continue;
    if (!reached(d)) break;
    currentStreak += 1;
  }

  // ---- 月度趋势 ----
  const trend = Array.from({ length: TREND_MONTHS }, (_, i) => {
    const month = addMonths(currentMonthString(), -(TREND_MONTHS - 1 - i));
    const days = [...datesWithTasks].filter((d) => d.startsWith(month));
    if (days.length === 0) return { month, rate: null };
    return { month, rate: days.filter(reached).length / days.length };
  });

  const selfReportRate = hasSubmittedData && completedTasks > 0 ? selfReported / completedTasks : null;

  return {
    activeDays,
    reachedDays,
    currentStreak,
    longestStreak,
    selfReportRate,
    completedTasks,
    trend,
    verdict: verdictFor({ activeDays, reachedDays, selfReportRate, currentStreak }),
  };
}

/**
 * 把几个数字翻译成一句家长能直接用的话。
 *
 * 阈值是拍的，不是从数据里学的——这里的目的是给一个讨论的起点，
 * 而不是假装系统知道别人家孩子什么时候该断奶。措辞上都留了余地。
 */
function verdictFor(s: {
  activeDays: number;
  reachedDays: number;
  selfReportRate: number | null;
  currentStreak: number;
}): string {
  if (s.activeDays < 14) return "数据还太少，再积累两周才看得出趋势。";

  const rate = s.reachedDays / s.activeDays;
  const self = s.selfReportRate;

  if (rate >= 0.9 && self !== null && self >= 0.85) {
    return `近三个月达标率 ${Math.round(rate * 100)}%，其中 ${Math.round(self * 100)}% 是他自己当天提交的。习惯基本稳了，可以考虑提高任务难度、拉长奖励冷却，让外部奖励慢慢淡出。`;
  }
  if (rate >= 0.9) {
    return `近三个月达标率 ${Math.round(rate * 100)}%，非常稳。不过很多任务是你事后补批的，还看不出他能不能自己想起来——可以试着几天不提醒，看看数字怎么变。`;
  }
  if (rate >= 0.7) {
    return `近三个月达标率 ${Math.round(rate * 100)}%，处在"记得做但需要提醒"的阶段。先别加难度，保持现在的节奏。`;
  }
  if (s.currentStreak >= 5) {
    return `近三个月达标率只有 ${Math.round(rate * 100)}%，但最近连续达标 ${s.currentStreak} 天，正在往回走。`;
  }
  return `近三个月达标率 ${Math.round(rate * 100)}%，偏低。与其加奖励，不如先看看任务是不是排得太多或太难——达标线和任务量在「经济体检」里能一眼看到。`;
}
