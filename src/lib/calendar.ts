import { LedgerType, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getDayType, type DayType } from "@/lib/holidays";
import {
  addMonths,
  currentMonthString,
  dateStringToUtcDate,
  datesInMonth,
  formatStoredDate,
  todayDateString,
} from "@/lib/date";

/** 月度满勤奖的金额，以及"多少比例的有任务日达标"才算满勤。 */
export const MONTHLY_BONUS_POINTS = 100;
export const MONTHLY_BONUS_RATIO = 0.95;

export type DayCell = {
  date: string; // YYYY-MM-DD
  earned: number; // 当天已批准任务加起来发了多少阳光
  totalTasks: number; // 当天一共排了几个任务（不含已取消）
  doneTasks: number;
  hasTasks: boolean;
  reachedGoal: boolean; // earned >= 每日达标线
  planted: boolean; // 当天种过植物（种了就免疫僵尸）
  isFuture: boolean;
  dayType: DayType; // 按国家放假安排：工作日 / 普通周末 / 法定节假日
  holidayName: string | null; // 节假日名字，比如"国庆节"
  isMakeupWorkday: boolean; // 调休补班的周末
};

export type MonthSummary = {
  month: string; // YYYY-MM
  dailyGoalPoints: number;
  days: DayCell[];
  taskDays: number; // 有任务的天数（满勤率的分母）
  reachedDays: number; // 其中达标的天数
  monthEarned: number;
  bonusRatio: number; // 需要达到的比例
  onTrackForBonus: boolean;
  bonusGranted: boolean; // 这个月的满勤奖是否已经发过
};

/**
 * 汇总某个月的日历数据。"当天赚了多少阳光"按 DailyTask.date 归集（而不是按流水的创建时间），
 * 这样家长隔天补批准，那笔阳光仍然算在任务本来所属的那一天上，日历不会错位。
 */
export async function getMonthSummary(childId: string, month: string): Promise<MonthSummary> {
  const child = await prisma.child.findUnique({ where: { id: childId } });
  if (!child) throw new ActionError("找不到这个孩子");

  const dates = datesInMonth(month);
  const monthStart = dateStringToUtcDate(dates[0]);
  const monthEnd = dateStringToUtcDate(dates[dates.length - 1]);
  const today = todayDateString();

  const [tasks, plants, bonusEntry] = await Promise.all([
    prisma.dailyTask.findMany({
      where: {
        childId,
        date: { gte: monthStart, lte: monthEnd },
        status: { not: TaskStatus.CANCELLED },
      },
      select: { date: true, status: true, points: true },
    }),
    prisma.plant.findMany({
      where: { childId, plantedOnDate: { gte: monthStart, lte: monthEnd } },
      select: { plantedOnDate: true },
    }),
    // 只用于页面上显示"本月奖励已发过"这一句提示。真正防重复发放靠的是
    // settleMonthlyBonusForChild 里的游标，不依赖这个字符串匹配。
    prisma.pointsLedger.findFirst({
      where: { childId, type: LedgerType.MONTHLY_BONUS, reason: { startsWith: month } },
    }),
  ]);

  const plantedDates = new Set(
    plants.map((p) => (p.plantedOnDate ? formatStoredDate(p.plantedOnDate) : "")).filter(Boolean)
  );

  const byDate = new Map<string, { total: number; done: number; earned: number }>();
  for (const task of tasks) {
    const key = formatStoredDate(task.date);
    const cell = byDate.get(key) ?? { total: 0, done: 0, earned: 0 };
    cell.total += 1;
    if (task.status === TaskStatus.DONE) {
      cell.done += 1;
      cell.earned += task.points;
    }
    byDate.set(key, cell);
  }

  const days: DayCell[] = dates.map((date) => {
    const cell = byDate.get(date) ?? { total: 0, done: 0, earned: 0 };
    const { type: dayType, holidayName, isMakeupWorkday } = getDayType(date);
    return {
      date,
      earned: cell.earned,
      totalTasks: cell.total,
      doneTasks: cell.done,
      hasTasks: cell.total > 0,
      reachedGoal: cell.earned >= child.dailyGoalPoints,
      planted: plantedDates.has(date),
      isFuture: date > today,
      dayType,
      holidayName,
      isMakeupWorkday,
    };
  });

  const taskDays = days.filter((d) => d.hasTasks).length;
  const reachedDays = days.filter((d) => d.hasTasks && d.reachedGoal).length;

  return {
    month,
    dailyGoalPoints: child.dailyGoalPoints,
    days,
    taskDays,
    reachedDays,
    monthEarned: days.reduce((sum, d) => sum + d.earned, 0),
    bonusRatio: MONTHLY_BONUS_RATIO,
    onTrackForBonus: taskDays > 0 && reachedDays >= Math.ceil(taskDays * MONTHLY_BONUS_RATIO),
    bonusGranted: Boolean(bonusEntry),
  };
}

/**
 * 懒结算月度满勤奖：从 bonusSettledThrough 的下个月开始，逐月判定到"上个月"为止
 * （当月还没过完不判）。某个月满勤 = 该月有任务的日子里，达标（当天拿到 ≥ dailyGoalPoints 阳光）
 * 的比例 ≥ 95%。整个月一个任务都没排的月份直接跳过，不发奖也不算失败。
 *
 * 和花园结算一样是幂等的：游标在事务里推进，重复调用不会重复发奖。可以放心在多个页面调用。
 */
export async function settleMonthlyBonusForChild(childId: string): Promise<string[]> {
  const currentMonth = currentMonthString();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");

    let cursor = child.bonusSettledThrough
      ? addMonths(formatStoredDate(child.bonusSettledThrough).slice(0, 7), 1)
      : currentMonth;

    const awardedMonths: string[] = [];
    let lastSettled: string | null = null;

    while (cursor < currentMonth) {
      const dates = datesInMonth(cursor);
      const tasks = await tx.dailyTask.findMany({
        where: {
          childId,
          date: {
            gte: dateStringToUtcDate(dates[0]),
            lte: dateStringToUtcDate(dates[dates.length - 1]),
          },
          status: { not: TaskStatus.CANCELLED },
        },
        select: { date: true, status: true, points: true },
      });

      const earnedByDate = new Map<string, number>();
      const taskDates = new Set<string>();
      for (const task of tasks) {
        const key = formatStoredDate(task.date);
        taskDates.add(key);
        if (task.status === TaskStatus.DONE) {
          earnedByDate.set(key, (earnedByDate.get(key) ?? 0) + task.points);
        }
      }

      const taskDays = taskDates.size;
      const reachedDays = [...taskDates].filter(
        (d) => (earnedByDate.get(d) ?? 0) >= child.dailyGoalPoints
      ).length;

      if (taskDays > 0 && reachedDays >= Math.ceil(taskDays * MONTHLY_BONUS_RATIO)) {
        await tx.pointsLedger.create({
          data: {
            childId,
            amount: MONTHLY_BONUS_POINTS,
            reason: `${cursor} 月度满勤奖励（${reachedDays}/${taskDays} 天达标）`,
            type: LedgerType.MONTHLY_BONUS,
          },
        });
        awardedMonths.push(cursor);
      }

      lastSettled = cursor;
      cursor = addMonths(cursor, 1);
    }

    if (lastSettled) {
      await tx.child.update({
        where: { id: childId },
        data: { bonusSettledThrough: dateStringToUtcDate(`${lastSettled}-01`) },
      });
    }

    return awardedMonths;
  });
}

export async function setDailyGoalPoints(childId: string, points: number) {
  if (!Number.isInteger(points) || points <= 0) {
    throw new ActionError("每日达标线要是一个大于 0 的整数");
  }
  return prisma.child.update({ where: { id: childId }, data: { dailyGoalPoints: points } });
}
