import { LedgerType, PlantStatus, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { addDays, dateStringToUtcDate, formatStoredDate, todayDateString } from "@/lib/date";
import { ensureDailyTasksForDate } from "@/lib/tasks";

/**
 * 花园格子总数。选 12：
 * - 按最便宜植物 15 阳光、日常收入约 10~20 阳光估算，种满至少要连续攒十几天，不会一下子腻了；
 * - 也不至于"永远种不满"，让孩子完全不在意花园的完整度；
 * - 阳光和"攒钱换真实礼物"共享同一个货币池，12 格给了"偶尔种一棵、偶尔攒钱换礼物"的取舍空间，
 *   不会逼着孩子只能二选一。
 */
export const GARDEN_SIZE = 12;

export type GardenEvent =
  | { date: string; outcome: "PLANT_EATEN"; plantTitle: string; plantEmoji: string | null }
  | { date: string; outcome: "GARDEN_EMPTY" };

/**
 * 懒结算花园：从 gardenSettledThrough 的次日开始，逐天判定到"昨天"为止（今天永远不判，
 * 因为今天还没过完）。某一天"算不算安全"：
 *   - 先回填那天缺失的周期任务（防止"不开 App 就躲过判定"）；
 *   - 该天有任务（排除 CANCELLED）且全部 DONE 才算安全；
 *   - 该天完全没有任务（真实意义上的休息日）也算安全，不惩罚；
 *   - 有任务处于 PENDING 或 PENDING_REVIEW（提交了但家长还没批）就算"没通过"。
 * 整个函数在一个事务里执行，对 Child 行加 FOR UPDATE 锁防止并发重复结算。
 * 返回值是这次调用新产生的事件，调用方（花园页面）用来渲染一次性提示——游标已经在
 * 事务里推进过，下次再调用会读到空数组，天然只提示一次，不需要额外的"已读"标记字段。
 *
 * 只应该在孩子端花园页面调用。家长端如果要看花园，用只读查询，不要调用这个函数，
 * 否则会抢先"消耗"掉本该展示给孩子的一次性事件。
 */
export async function settleGardenForChild(childId: string): Promise<GardenEvent[]> {
  const todayStr = todayDateString();

  return prisma.$transaction(async (tx) => {
    // 锁住这个孩子的 Child 行，把同一孩子的并发结算请求序列化，避免重复吃植物。
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");

    let cursor = child.gardenSettledThrough
      ? addDays(formatStoredDate(child.gardenSettledThrough), 1)
      : todayDateString(child.createdAt);

    const events: GardenEvent[] = [];
    let lastSettled: string | null = null;

    while (cursor < todayStr) {
      await ensureDailyTasksForDate(tx, childId, cursor);

      const dayTasks = await tx.dailyTask.findMany({
        where: {
          childId,
          date: dateStringToUtcDate(cursor),
          status: { not: TaskStatus.CANCELLED },
        },
      });

      const isSafe = dayTasks.length === 0 || dayTasks.every((t) => t.status === TaskStatus.DONE);

      if (!isSafe) {
        const alivePlants = await tx.plant.findMany({
          where: { childId, status: PlantStatus.ALIVE },
        });

        if (alivePlants.length === 0) {
          events.push({ date: cursor, outcome: "GARDEN_EMPTY" });
        } else {
          const chosen = alivePlants[Math.floor(Math.random() * alivePlants.length)];
          await tx.plant.update({
            where: { id: chosen.id },
            data: {
              status: PlantStatus.EATEN,
              eatenAt: new Date(),
              eatenOnDate: dateStringToUtcDate(cursor),
            },
          });
          events.push({
            date: cursor,
            outcome: "PLANT_EATEN",
            plantTitle: chosen.title,
            plantEmoji: chosen.emoji,
          });
        }
      }

      lastSettled = cursor;
      cursor = addDays(cursor, 1);
    }

    if (lastSettled) {
      await tx.child.update({
        where: { id: childId },
        data: { gardenSettledThrough: dateStringToUtcDate(lastSettled) },
      });
    }

    return events;
  });
}

/**
 * 孩子种下一棵植物：事务内校验植物类型存在且启用、余额重新聚合校验够用（防并发透支，
 * 写法同 lib/rewards.ts 的 redeemReward），自动挑编号最小的空闲格子（不做拖拽选格子的 UI）。
 */
export async function plantSeed(plantTypeId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const plantType = await tx.plantType.findUnique({ where: { id: plantTypeId } });
    if (!plantType || plantType.childId !== childId || !plantType.active) {
      throw new ActionError("这种植物现在没法种");
    }

    const balanceResult = await tx.pointsLedger.aggregate({
      where: { childId },
      _sum: { amount: true },
    });
    const balance = balanceResult._sum.amount ?? 0;
    if (balance < plantType.cost) {
      throw new ActionError("阳光还不够哦");
    }

    const alivePlants = await tx.plant.findMany({
      where: { childId, status: PlantStatus.ALIVE },
      select: { slot: true },
    });
    const occupied = new Set(alivePlants.map((p) => p.slot));
    let freeSlot = -1;
    for (let i = 0; i < GARDEN_SIZE; i++) {
      if (!occupied.has(i)) {
        freeSlot = i;
        break;
      }
    }
    if (freeSlot === -1) {
      throw new ActionError("花园已经种满了，先兑换一个礼物腾地方，或者等僵尸来访吧");
    }

    const plant = await tx.plant.create({
      data: {
        childId,
        plantTypeId: plantType.id,
        title: plantType.title,
        emoji: plantType.emoji,
        slot: freeSlot,
        status: PlantStatus.ALIVE,
      },
    });

    await tx.pointsLedger.create({
      data: {
        childId,
        amount: -plantType.cost,
        reason: `种植物：${plantType.title}`,
        type: LedgerType.PLANT_SEED,
        plantId: plant.id,
      },
    });

    return plant;
  });
}
