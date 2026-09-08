import { LedgerType, TaskStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { addMonths, currentMonthString, dateStringToUtcDate, datesInMonth } from "@/lib/date";

export type SpendBucket = { label: string; amount: number; count: number };

export type MonthStats = {
  month: string;
  /** 排了任务的天数 */
  taskDays: number;
  /** 其中达标的天数 */
  reachedDays: number;
  /** 达标天数占比，0~1；没有任务日时为 0 */
  reachedRatio: number;
  /** 任务总数 / 已批准数 */
  totalTasks: number;
  doneTasks: number;
  /** 本月赚到的阳光（含满勤奖、家长手动加分） */
  earned: number;
  /** 各来源赚了多少 */
  earnedBuckets: SpendBucket[];
  /** 本月花掉的阳光（正数） */
  spent: number;
  /** 花在哪了 */
  spentBuckets: SpendBucket[];
  /** 具体兑换了哪些礼物 / 种了哪些植物 */
  rewardDetail: SpendBucket[];
  plantDetail: SpendBucket[];
};

const EARN_LABELS: Partial<Record<LedgerType, string>> = {
  TASK_COMPLETE: "完成任务",
  MONTHLY_BONUS: "月度满勤奖",
  MANUAL_ADJUST: "家长手动加分",
};

const SPEND_LABELS: Partial<Record<LedgerType, string>> = {
  REDEMPTION: "兑换礼物",
  PLANT_SEED: "种植物",
  TASK_REVOKE: "撤销打卡扣回",
  MANUAL_ADJUST: "家长手动扣分",
};

function toBuckets(
  entries: { type: LedgerType; amount: number }[],
  labels: Partial<Record<LedgerType, string>>
): SpendBucket[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const e of entries) {
    const label = labels[e.type] ?? e.type;
    const cur = map.get(label) ?? { amount: 0, count: 0 };
    cur.amount += Math.abs(e.amount);
    cur.count += 1;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.amount - a.amount);
}

/** 汇总某个月的完成情况和阳光收支，用于家长端仪表盘的数据分析。 */
export async function getMonthStats(childId: string, month: string): Promise<MonthStats> {
  const child = await prisma.child.findUniqueOrThrow({ where: { id: childId } });
  const dates = datesInMonth(month);
  const monthStart = dateStringToUtcDate(dates[0]);
  const monthEnd = dateStringToUtcDate(dates[dates.length - 1]);
  // 流水按创建时间归集，用 [月初, 下月初) 的半开区间，避免月末最后一天被漏掉。
  const nextMonthStart = dateStringToUtcDate(`${addMonths(month, 1)}-01`);

  const [tasks, ledger, redemptions, plants] = await Promise.all([
    prisma.dailyTask.findMany({
      where: {
        childId,
        date: { gte: monthStart, lte: monthEnd },
        status: { not: TaskStatus.CANCELLED },
      },
      select: { date: true, status: true, points: true },
    }),
    prisma.pointsLedger.findMany({
      where: { childId, createdAt: { gte: monthStart, lt: nextMonthStart } },
      select: { type: true, amount: true },
    }),
    prisma.redemption.findMany({
      where: { childId, createdAt: { gte: monthStart, lt: nextMonthStart } },
      select: { rewardTitle: true, cost: true },
    }),
    prisma.plant.findMany({
      where: { childId, plantedOnDate: { gte: monthStart, lte: monthEnd } },
      select: { title: true, plantTypeId: true, plantType: { select: { cost: true } } },
    }),
  ]);

  const earnedByDate = new Map<string, number>();
  const taskDates = new Set<string>();
  let doneTasks = 0;
  for (const t of tasks) {
    const key = t.date.toISOString().slice(0, 10);
    taskDates.add(key);
    if (t.status === TaskStatus.DONE) {
      doneTasks += 1;
      earnedByDate.set(key, (earnedByDate.get(key) ?? 0) + t.points);
    }
  }
  const taskDays = taskDates.size;
  const reachedDays = [...taskDates].filter(
    (d) => (earnedByDate.get(d) ?? 0) >= child.dailyGoalPoints
  ).length;

  const earnEntries = ledger.filter((e) => e.amount > 0);
  const spendEntries = ledger.filter((e) => e.amount < 0);

  const groupDetail = (rows: { label: string; cost: number }[]): SpendBucket[] => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.label) ?? { amount: 0, count: 0 };
      cur.amount += r.cost;
      cur.count += 1;
      map.set(r.label, cur);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.amount - a.amount);
  };

  return {
    month,
    taskDays,
    reachedDays,
    reachedRatio: taskDays > 0 ? reachedDays / taskDays : 0,
    totalTasks: tasks.length,
    doneTasks,
    earned: earnEntries.reduce((s, e) => s + e.amount, 0),
    earnedBuckets: toBuckets(earnEntries, EARN_LABELS),
    spent: spendEntries.reduce((s, e) => s + Math.abs(e.amount), 0),
    spentBuckets: toBuckets(spendEntries, SPEND_LABELS),
    rewardDetail: groupDetail(redemptions.map((r) => ({ label: r.rewardTitle, cost: r.cost }))),
    plantDetail: groupDetail(plants.map((p) => ({ label: p.title, cost: p.plantType.cost }))),
  };
}

/** 最近 N 个月的趋势（含当月），用于折线/柱状对比。 */
export async function getRecentMonthsStats(childId: string, count = 6): Promise<MonthStats[]> {
  const months = Array.from({ length: count }, (_, i) =>
    addMonths(currentMonthString(), -(count - 1 - i))
  );
  return Promise.all(months.map((m) => getMonthStats(childId, m)));
}
