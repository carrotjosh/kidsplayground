import { CaughtStatus, TaskStatus, type Prisma } from "@/generated/prisma/client";

/**
 * 逃跑规则：当天挣到的阳光（已完成任务的分值之和）**低于这个数**，就随机跑掉一只已拥有的宝可梦。
 * 口径和日历的「当天挣到」完全一致（见 calendar.ts 的 cell.earned）。
 *
 * 放在这个独立的小模块里，是因为 tasks.ts（补批时要回收逃跑的宝可梦）和
 * pokedex.ts（结算时判定逃跑）都要用它，而这两个文件互相 import 会成环。
 */
export const FLEE_EARN_THRESHOLD = 5;

/** 某一天当前挣到多少阳光（只算已完成的，取消的不算）。 */
export async function earnedOnDate(
  tx: Prisma.TransactionClient,
  childId: string,
  date: Date
): Promise<number> {
  const rows = await tx.dailyTask.findMany({
    where: { childId, date, status: { not: TaskStatus.CANCELLED } },
    select: { points: true, status: true },
  });
  return rows
    .filter((t) => t.status === TaskStatus.DONE)
    .reduce((sum, t) => sum + t.points, 0);
}

/**
 * 补批之后：如果那一天之前因为挣得太少跑了一只，而现在挣到的已经够了，就把它接回来。
 * 返回接回来的那只（没有就返回 null）。每天最多跑一只，所以按日期找到的就是那只。
 */
export async function restoreFledIfRecovered(
  tx: Prisma.TransactionClient,
  childId: string,
  date: Date
) {
  const fled = await tx.caught.findFirst({
    where: { childId, status: CaughtStatus.FLED, fledOnDate: date },
  });
  if (!fled) return null;
  if ((await earnedOnDate(tx, childId, date)) < FLEE_EARN_THRESHOLD) return null;

  await tx.caught.update({
    where: { id: fled.id },
    data: { status: CaughtStatus.OWNED, fledOnDate: null },
  });
  return fled;
}
