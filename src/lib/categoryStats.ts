import { TaskStatus, type TaskCategory } from "@/generated/prisma/client";
import { addDays, dateStringToUtcDate, formatStoredDate, todayDateString } from "@/lib/date";
import { prisma } from "@/lib/db";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/taskCategory";

/**
 * 「孩子更爱做哪类任务」。
 *
 * 排序看**完成率**，不看完成了几项：完成的项数主要取决于家长排了多少——
 * 排了 4 个学习任务、1 个运动任务，学习的完成数天然就多，那说明不了他喜欢学习。
 *
 * 另一个指标是「自己当天提交」：完成的任务里，有多少是孩子当天自己点的「做完了」，
 * 而不是家长事后补批的。完成率高可能只是家长盯得紧；自己主动交的比例高，才更像是真喜欢。
 *
 * 窗口不含今天——今天还没过完，没做完的任务不代表不做。
 */

/** 默认看最近 30 天。比自觉性面板的 90 天短：喜好变得比习惯快。 */
export const CATEGORY_WINDOW_DAYS = 30;

/** 样本少于这个数的分类不参与「最爱 / 最常落下」的结论，免得 1/1 = 100% 当冠军。 */
const MIN_SAMPLE = 5;

export type CategoryRow = {
  /** null = 未分类（老的临时任务、来自已删除模板的任务） */
  category: TaskCategory | null;
  label: string;
  emoji: string;
  color: string;
  scheduled: number;
  done: number;
  /** done / scheduled */
  rate: number;
  /** 完成的里面，孩子当天自己提交的比例；没有完成就是 null */
  selfRate: number | null;
  earned: number;
};

export type CategoryStats = {
  days: number;
  rows: CategoryRow[];
  verdict: string;
};

export async function getCategoryStats(
  childId: string,
  days: number = CATEGORY_WINDOW_DAYS
): Promise<CategoryStats> {
  const today = todayDateString();
  const from = addDays(today, -days);
  const to = addDays(today, -1);

  const tasks = await prisma.dailyTask.findMany({
    where: {
      childId,
      date: { gte: dateStringToUtcDate(from), lte: dateStringToUtcDate(to) },
      status: { not: TaskStatus.CANCELLED },
    },
    select: { date: true, status: true, points: true, submittedAt: true, category: true },
  });

  type Acc = { scheduled: number; done: number; self: number; earned: number };
  const acc = new Map<TaskCategory | null, Acc>();
  for (const t of tasks) {
    const a = acc.get(t.category) ?? { scheduled: 0, done: 0, self: 0, earned: 0 };
    a.scheduled += 1;
    if (t.status === TaskStatus.DONE) {
      a.done += 1;
      a.earned += t.points;
      // 当天自己点的才算主动，第二天补点的、家长直接补批的都不算（同 lib/discipline.ts）
      if (t.submittedAt && todayDateString(t.submittedAt) === formatStoredDate(t.date)) a.self += 1;
    }
    acc.set(t.category, a);
  }

  const rows: CategoryRow[] = [...acc.entries()].map(([category, a]) => {
    const meta = category
      ? CATEGORY_META[category]
      : { label: "未分类", emoji: "❔", color: "bg-slate-300" };
    return {
      category,
      label: meta.label,
      emoji: meta.emoji,
      color: meta.color,
      scheduled: a.scheduled,
      done: a.done,
      rate: a.scheduled > 0 ? a.done / a.scheduled : 0,
      selfRate: a.done > 0 ? a.self / a.done : null,
      earned: a.earned,
    };
  });

  // 完成率高的在前；一样高就按固定顺序，未分类永远垫底
  const order = (c: TaskCategory | null) => (c ? CATEGORY_ORDER.indexOf(c) : 99);
  rows.sort((x, y) => {
    if (x.category === null) return 1;
    if (y.category === null) return -1;
    return y.rate - x.rate || order(x.category) - order(y.category);
  });

  return { days, rows, verdict: buildVerdict(rows) };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function buildVerdict(rows: CategoryRow[]): string {
  const ranked = rows.filter((r) => r.category !== null && r.scheduled >= MIN_SAMPLE);
  if (rows.length === 0) return "这段时间还没有任务记录。";
  if (ranked.length < 2) {
    return `每类任务至少排过 ${MIN_SAMPLE} 次才好比较，再攒几天数据。`;
  }
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  if (best.rate - worst.rate < 0.1) {
    return `各类任务的完成率差不多（都在 ${pct(worst.rate)}～${pct(best.rate)}），看不出明显偏好。`;
  }
  return `最常完成的是「${best.label}」（${pct(best.rate)}），最常落下的是「${worst.label}」（${pct(worst.rate)}）。`;
}
