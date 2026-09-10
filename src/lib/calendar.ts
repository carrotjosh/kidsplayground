import { LedgerType, ScheduleType, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getDayType, type DayType } from "@/lib/holidays";
import { isTemplateDueOn } from "@/lib/tasks";
import {
  addMonths,
  currentMonthString,
  dateStringToUtcDate,
  datesInMonth,
  formatStoredDate,
  todayDateString,
} from "@/lib/date";

/**
 * 月度满勤奖的金额，以及"多少比例的应打卡日达标"才算满勤。
 *
 * 比例定在 80% 而不是更高：一年级孩子每天都达标不现实，30 天的月份要求 24 天达标、
 * 允许漏 6 天，够得着又不至于随便就拿到。定太高（比如 95%，一个月只能漏 1 天）
 * 会让奖励在月中就变成"反正拿不到了"，激励直接失效。
 */
export const MONTHLY_BONUS_POINTS = 100;
export const MONTHLY_BONUS_RATIO = 0.8;

/**
 * 算出某个月里"本来就该打卡"的日子。
 *
 * 为什么不能直接数 DailyTask 的行数：DailyTask 是懒生成的——只有孩子打开 App、
 * 或者花园结算回填时才会落库。月中的时候未来的日子根本还没有行，没人开 App 的日子也没有。
 * 拿行数当分母会让满勤线随着月份推进一天天往上涨（月初显示"只要 8 天"），
 * 更糟的是月底真正结算时，孩子少开几天 App 反而让分母变小、满勤奖变得更容易拿。
 *
 * 所以分母改成按模板 + 法定节假日日历现算：
 *   - 落在这个月、且不早于孩子建档那天（建档之前的日子不该算他头上）；
 *   - 有任一启用中的模板在那天生效；
 *   - 或者那天实际有任务行（家长临时加的任务也得算进去）。
 *
 * 已知局限（和回填逻辑一致）：用的是**当前**的模板配置，模板改过之后回头看历史月份，
 * 算出来的是"按现在的模板本该打几天"。模型里没存模板的版本历史，暂时接受。
 */
export function scheduledTaskDates(
  month: string,
  templates: { scheduleType: ScheduleType; weekdays: number[] }[],
  childCreatedAt: Date,
  datesWithRows: Iterable<string>
): Set<string> {
  const since = todayDateString(childCreatedAt);
  const dates = new Set<string>();

  // 按模板"推算"出来的日子要卡建档时间：孩子还没建档的日子不该凭空算他头上。
  for (const date of datesInMonth(month)) {
    if (date < since) continue;
    if (templates.some((t) => isTemplateDueOn(t, date))) dates.add(date);
  }
  // 真实存在的任务行不卡建档时间：那天确实排了任务（可能是家长临时加的，也可能是导入的历史数据），
  // 就是实打实的应打卡日，没有理由不算。
  for (const date of datesWithRows) {
    dates.add(date);
  }
  return dates;
}

export type DayCell = {
  date: string; // YYYY-MM-DD
  earned: number; // 当天已批准任务加起来发了多少阳光
  totalTasks: number; // 当天一共排了几个任务（不含已取消）
  doneTasks: number;
  hasTasks: boolean;
  reachedGoal: boolean; // earned >= 每日达标线
  planted: boolean; // 当天有"收藏动作"：花园主题=种了植物，图鉴主题=抓到了宝可梦（都免疫当晚的惩罚）
  isFuture: boolean;
  dayType: DayType; // 按国家放假安排：工作日 / 普通周末 / 法定节假日
  holidayName: string | null; // 节假日名字，比如"国庆节"
  isMakeupWorkday: boolean; // 调休上学的周末
};

export type MonthSummary = {
  month: string; // YYYY-MM
  dailyGoalPoints: number;
  days: DayCell[];
  taskDays: number; // 这个月一共该打卡多少天（满勤率的分母，含还没到的日子）
  reachedDays: number; // 其中已经达标的天数
  remainingDays: number; // 应打卡日里还没过去的（今天及以后），用来判断满勤奖还有没有希望
  monthEarned: number;
  bonusRatio: number; // 需要达到的比例
  onTrackForBonus: boolean;
  bonusGranted: boolean; // 这个月的满勤奖是否已经发过
};

/**
 * 汇总某个月的日历数据。"当天赚了多少阳光"按 DailyTask.date 归集（而不是按流水的创建时间），
 * 这样家长隔天补批准，那笔阳光仍然算在任务本来所属的那一天上，日历不会错位。
 *
 * 参数收 child 对象而不是 childId：调用方（页面）本来就已经查过一次孩子了，
 * 这里再查一次就是一次多余的数据库往返——数据库在境外时一次往返要 200ms+，能省则省。
 */
export async function getMonthSummary(
  child: { id: string; dailyGoalPoints: number; createdAt: Date },
  month: string
): Promise<MonthSummary> {
  const childId = child.id;
  const dates = datesInMonth(month);
  const monthStart = dateStringToUtcDate(dates[0]);
  const monthEnd = dateStringToUtcDate(dates[dates.length - 1]);
  const today = todayDateString();

  const [tasks, plants, caught, bonusEntry, templates] = await Promise.all([
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
    prisma.caught.findMany({
      where: { childId, caughtOnDate: { gte: monthStart, lte: monthEnd } },
      select: { caughtOnDate: true },
    }),
    // 只用于页面上显示"本月奖励已发过"这一句提示。真正防重复发放靠的是
    // settleMonthlyBonusForChild 里的游标，不依赖这个字符串匹配。
    prisma.pointsLedger.findFirst({
      where: { childId, type: LedgerType.MONTHLY_BONUS, reason: { startsWith: month } },
    }),
    prisma.taskTemplate.findMany({
      where: { childId, active: true },
      select: { scheduleType: true, weekdays: true },
    }),
  ]);

  // 两个主题的"当天有动作"合并成一个集合：主题互斥，同一个孩子只会有其中一种记录。
  const plantedDates = new Set(
    [
      ...plants.map((p) => (p.plantedOnDate ? formatStoredDate(p.plantedOnDate) : "")),
      ...caught.map((c) => (c.caughtOnDate ? formatStoredDate(c.caughtOnDate) : "")),
    ].filter(Boolean)
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

  // 分母按模板现算，不是数已经落库的任务行——理由见 scheduledTaskDates 的注释。
  const scheduled = scheduledTaskDates(month, templates, child.createdAt, byDate.keys());
  const taskDays = scheduled.size;
  const reachedDays = days.filter((d) => scheduled.has(d.date) && d.reachedGoal).length;
  // 今天还没过完，仍算"还有机会达标"的一天
  const remainingDays = [...scheduled].filter((d) => d >= today).length;

  return {
    month,
    dailyGoalPoints: child.dailyGoalPoints,
    days,
    taskDays,
    reachedDays,
    remainingDays,
    monthEarned: days.reduce((sum, d) => sum + d.earned, 0),
    bonusRatio: MONTHLY_BONUS_RATIO,
    onTrackForBonus: taskDays > 0 && reachedDays >= Math.ceil(taskDays * MONTHLY_BONUS_RATIO),
    bonusGranted: Boolean(bonusEntry),
  };
}

export type DayDetail = {
  date: string;
  dailyGoalPoints: number;
  earned: number;
  reachedGoal: boolean;
  isToday: boolean;
  dayType: DayType;
  holidayName: string | null;
  isMakeupWorkday: boolean;
  tasks: {
    id: string;
    title: string;
    subject: string | null;
    amount: number | null;
    unit: string | null;
    emoji: string | null;
    points: number;
    status: TaskStatus;
  }[];
  plants: { title: string; emoji: string | null }[];
};

/**
 * 某一天的明细：当天排了哪些任务、各自什么状态、一共拿了多少阳光、有没有种植物。
 * 孩子点日历格子进来看的就是这个，纯只读——补做任务要家长在后台补打卡。
 *
 * 不在这里补生成缺失的 DailyTask：这是个只读视图，写库应该发生在"今天"的入口
 * （getOrCreateTodayTasks）和花园结算里，那两处才拿得到正确的上下文。
 */
export async function getDayDetail(
  child: { id: string; dailyGoalPoints: number },
  date: string
): Promise<DayDetail> {
  const stored = dateStringToUtcDate(date);

  const [tasks, plants] = await Promise.all([
    prisma.dailyTask.findMany({
      where: { childId: child.id, date: stored, status: { not: TaskStatus.CANCELLED } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        subject: true,
        amount: true,
        unit: true,
        emoji: true,
        points: true,
        status: true,
      },
    }),
    prisma.plant.findMany({
      where: { childId: child.id, plantedOnDate: stored },
      select: { title: true, emoji: true },
    }),
  ]);

  const earned = tasks
    .filter((t) => t.status === TaskStatus.DONE)
    .reduce((sum, t) => sum + t.points, 0);
  const { type: dayType, holidayName, isMakeupWorkday } = getDayType(date);

  return {
    date,
    dailyGoalPoints: child.dailyGoalPoints,
    earned,
    reachedGoal: earned >= child.dailyGoalPoints,
    isToday: date === todayDateString(),
    dayType,
    holidayName,
    isMakeupWorkday,
    tasks,
    plants,
  };
}

/**
 * 懒结算月度满勤奖：从 bonusSettledThrough 的下个月开始，逐月判定到"上个月"为止
 * （当月还没过完不判）。某个月满勤 = 该月有任务的日子里，达标（当天拿到 ≥ dailyGoalPoints 阳光）
 * 的比例 ≥ MONTHLY_BONUS_RATIO。整个月一个任务都没排的月份直接跳过，不发奖也不算失败。
 *
 * 和花园结算一样是幂等的：游标在事务里推进，重复调用不会重复发奖。可以放心在多个页面调用。
 *
 * 参数收 child 对象：调用方已经查过孩子了，直接用它身上的游标先判断有没有要结算的月份。
 * 绝大多数时候（一个月里的其它 30 天）都没有，就能整个跳过下面这个事务——
 * 省掉 4 次数据库往返，这在数据库离用户很远的时候是每次打开页面都要付的成本。
 */
export async function settleMonthlyBonusForChild(child: {
  id: string;
  bonusSettledThrough: Date | null;
}): Promise<string[]> {
  const currentMonth = currentMonthString();
  const childId = child.id;

  const pendingFrom = child.bonusSettledThrough
    ? addMonths(formatStoredDate(child.bonusSettledThrough).slice(0, 7), 1)
    : currentMonth;
  if (pendingFrom >= currentMonth) {
    return []; // 没有待结算的完整月份，不用开事务
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    // 锁之后重新读一次：可能有并发请求刚刚结算过并推进了游标。
    const locked = await tx.child.findUnique({ where: { id: childId } });
    if (!locked) throw new ActionError("找不到这个孩子");

    let cursor = locked.bonusSettledThrough
      ? addMonths(formatStoredDate(locked.bonusSettledThrough).slice(0, 7), 1)
      : currentMonth;

    const awardedMonths: string[] = [];
    let lastSettled: string | null = null;

    const templates = await tx.taskTemplate.findMany({
      where: { childId, active: true },
      select: { scheduleType: true, weekdays: true },
    });

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
      const datesWithRows = new Set<string>();
      for (const task of tasks) {
        const key = formatStoredDate(task.date);
        datesWithRows.add(key);
        if (task.status === TaskStatus.DONE) {
          earnedByDate.set(key, (earnedByDate.get(key) ?? 0) + task.points);
        }
      }

      // 分母同样按模板现算。要是拿"有任务行的天数"当分母，孩子少开几天 App
      // 就少几行记录、分母跟着缩水，反而更容易拿到满勤奖——正好奖励了不打卡。
      const scheduled = scheduledTaskDates(cursor, templates, locked.createdAt, datesWithRows);
      const taskDays = scheduled.size;
      // 用锁内重新读到的 locked，拿的是最新的达标线
      const reachedDays = [...scheduled].filter(
        (d) => (earnedByDate.get(d) ?? 0) >= locked.dailyGoalPoints
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
