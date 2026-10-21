import { CaughtStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { dateStringToUtcDate, formatStoredDate } from "@/lib/date";
import { prisma } from "@/lib/db";

/**
 * 请假日：孩子生病、全家出门这类「这天允许不打卡」的日子。
 *
 * 一个请假日在所有判定里都是**中性**的——不是"算他完成了"，而是"这天不算"：
 *   - 宝可梦不会因为这天跑掉（pokedex.ts 的 settlePokedexForChild）
 *   - 不进满勤奖的分母，也不算达标（calendar.ts）
 *   - 不打断、也不延长连续达标（discipline.ts）
 *   - 不进「更爱做哪类任务」的统计（categoryStats.ts）
 *
 * 任务本身**不动**：孩子那天精神好想读个书，照样能做、照样发阳光。
 * 所以撤销请假也只是删掉这一条记录，什么都不用恢复。
 *
 * 为什么不是把那天的任务改成「已取消」：满勤奖的分母是按**模板**现算的
 * （calendar.ts 的 scheduledTaskDates），不看任务行，取消任务那天照样算一个该打卡的日子。
 */

/** 事务客户端和普通 PrismaClient 共用的最小接口（同 tasks.ts 的 Db）。 */
type Db = { excusedDay: typeof prisma.excusedDay };

/** [from, to] 范围内的请假日，键是 YYYY-MM-DD，值是原因。 */
export async function getExcusedDates(
  db: Db,
  childId: string,
  from: string,
  to: string
): Promise<Map<string, string>> {
  const rows = await db.excusedDay.findMany({
    where: { childId, date: { gte: dateStringToUtcDate(from), lte: dateStringToUtcDate(to) } },
    select: { date: true, reason: true },
  });
  return new Map(rows.map((r) => [formatStoredDate(r.date), r.reason]));
}

/**
 * 把某天标成请假。重复标同一天只更新原因。
 *
 * 如果那天已经被判过、跑掉了一只宝可梦，**一并接回来**——和补批让那天够 5 阳光时
 * 一样（flee.ts 的 restoreFledIfRecovered）。家长常常是第二天才想起来标的。
 */
export async function excuseDay(childId: string, date: string, reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) throw new ActionError("请写一下原因，比如「发烧」");
  if (trimmed.length > 20) throw new ActionError("原因太长了，20 个字以内");

  const day = dateStringToUtcDate(date);
  return prisma.$transaction(async (tx) => {
    await tx.excusedDay.upsert({
      where: { childId_date: { childId, date: day } },
      create: { childId, date: day, reason: trimmed },
      update: { reason: trimmed },
    });
    const fled = await tx.caught.findMany({
      where: { childId, status: CaughtStatus.FLED, fledOnDate: day },
      select: { id: true, nameZh: true },
    });
    if (fled.length > 0) {
      await tx.caught.updateMany({
        where: { id: { in: fled.map((f) => f.id) } },
        data: { status: CaughtStatus.OWNED, fledOnDate: null },
      });
    }
    return { restored: fled.map((f) => f.nameZh) };
  });
}

/**
 * 撤销请假。不会回头补判：结算游标早就走过这天了，撤销只影响满勤奖、连续达标这类
 * 每次现算的统计。真要罚，就是这天"没被罚"，这是更安全的那一边。
 */
export async function unexcuseDay(childId: string, date: string) {
  await prisma.excusedDay.deleteMany({ where: { childId, date: dateStringToUtcDate(date) } });
}
