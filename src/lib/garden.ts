import { LedgerType, PlantStatus, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  addDays,
  dateStringToUtcDate,
  formatStoredDate,
  todayAsUtcDate,
  todayDateString,
} from "@/lib/date";
import { ensureDailyTasksForDate } from "@/lib/tasks";

/** 花园是 4×4 的格子。 */
export const GARDEN_COLS = 4;
export const GARDEN_ROWS = 4;
export const GARDEN_SIZE = GARDEN_COLS * GARDEN_ROWS; // 16

/** 一"套"= 每种植物要种够几棵。4 种植物 × 各 4 棵 = 16，正好铺满 4×4 的花园。 */
export const GARDEN_SET_SIZE = 4;

/**
 * 集齐一整套后的收获倍率：把这一园植物**实际花掉的阳光**乘上这个数还给孩子。
 *
 * 为什么不是一个固定数字（原来写死 50）：植物价格是家长在后台随时能改的，
 * 固定奖励一旦低于种满一园的总成本，孩子就是"花 76 换回 50"，理性的做法是永远不收获、
 * 甚至永远不种——整个花园玩法就废了。按倍率算的话，奖励天然跟着成本走，改价也不会翻车。
 *
 * 1.5 的含义：种满一整套能连本带利拿回 150%。这不是白送——那些阳光在花园里是锁死的
 * （不能拿去换礼物），而且任务没完成时僵尸会吃掉植物、那部分投入就亏了。
 * 所以本质是"坚持打卡就能拿到的利息"，正好是想要的激励方向。
 */
export const GARDEN_HARVEST_MULTIPLIER = 1.5;

/**
 * 算一园植物值多少收获奖励。
 *
 * 成本取的是当初那条 PLANT_SEED 流水（种下时真的扣了多少），不是植物目录上的现价——
 * 家长中途改价、甚至把品种删了，都不该影响已经种下去的这些植物值多少钱。
 * 万一流水缺失（比如脚本直接造的测试数据），退回用目录现价兜底。
 */
export function computeHarvestBonus(
  plants: { ledgerEntry: { amount: number } | null; plantType: { cost: number } | null }[]
): { spent: number; bonus: number } {
  const spent = plants.reduce(
    (sum, p) => sum + Math.abs(p.ledgerEntry?.amount ?? p.plantType?.cost ?? 0),
    0
  );
  return { spent, bonus: Math.ceil(spent * GARDEN_HARVEST_MULTIPLIER) };
}

export type GardenEvent =
  | { date: string; outcome: "PLANT_EATEN"; plantTitle: string; plantEmoji: string | null }
  | { date: string; outcome: "GARDEN_EMPTY" };

export type GardenProgressEntry = {
  plantTypeId: string;
  title: string;
  emoji: string | null;
  alive: number;
  needed: number;
};

export type GardenProgress = {
  entries: GardenProgressEntry[];
  /** 每个上架品种都种够 GARDEN_SET_SIZE 棵 —— 可以收获了 */
  complete: boolean;
  /** 花园里还活着、但已经不属于当前目标的植物棵数（品种被家长下架或删掉了），它们照样占格子 */
  strayAlive: number;
  /** 一整套 + 那些占着格子的"编外"植物，能不能塞进 GARDEN_SIZE 个格子 */
  achievable: boolean;
  /** 现在园子里这些植物一共花了多少阳光 */
  spent: number;
  /** 现在收获能拿多少（集齐前也算出来给孩子看，知道攒下去值多少） */
  bonus: number;
};

/**
 * 从"上架中的植物品种"和"当前存活的植物"算出集卡进度。写成纯函数，
 * 是为了让页面（已经查过这两份数据）和 harvestGarden（在事务里重新查一遍）能共用同一套判定，
 * 不会出现"页面说能收，服务端说不能收"的分歧。
 *
 * 判定用的是"上架中"的品种：家长下架某种植物后，那一种就不再算进集卡目标里，
 * 否则改了目录之后孩子的花园会永远集不齐。但已经种下的那几棵还活着、还占着格子，
 * 所以要单独数出来（strayAlive）参与 achievable 的判断，不然会出现"目标看着能达成、
 * 实际上格子不够"的死局。
 */
export function computeGardenProgress(
  activeTypes: { id: string; title: string; emoji: string | null }[],
  alivePlants: {
    plantTypeId: string | null;
    ledgerEntry?: { amount: number } | null;
    plantType?: { cost: number } | null;
  }[]
): GardenProgress {
  const activeIds = new Set(activeTypes.map((t) => t.id));
  const aliveByType = new Map<string, number>();
  let strayAlive = 0;
  for (const plant of alivePlants) {
    if (plant.plantTypeId && activeIds.has(plant.plantTypeId)) {
      aliveByType.set(plant.plantTypeId, (aliveByType.get(plant.plantTypeId) ?? 0) + 1);
    } else {
      strayAlive += 1;
    }
  }

  const entries = activeTypes.map((type) => ({
    plantTypeId: type.id,
    title: type.title,
    emoji: type.emoji,
    alive: aliveByType.get(type.id) ?? 0,
    needed: GARDEN_SET_SIZE,
  }));

  const { spent, bonus } = computeHarvestBonus(
    alivePlants.map((p) => ({
      ledgerEntry: p.ledgerEntry ?? null,
      plantType: p.plantType ?? null,
    }))
  );

  return {
    entries,
    complete: entries.length > 0 && entries.every((e) => e.alive >= e.needed),
    strayAlive,
    achievable:
      entries.length > 0 && entries.length * GARDEN_SET_SIZE + strayAlive <= GARDEN_SIZE,
    spent,
    bonus,
  };
}

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

      // 当天种过植物就免疫僵尸——新种下的那棵挡住了这一晚。
      // 注意花园只有 GARDEN_SIZE 个格子、种满就不能再种，所以这张"免死金牌"天然有上限，
      // 孩子没法靠每天买一棵便宜植物无限逃避任务。
      const plantedToday = await tx.plant.count({
        where: { childId, plantedOnDate: dateStringToUtcDate(cursor) },
      });

      const isSafe =
        plantedToday > 0 ||
        dayTasks.length === 0 ||
        dayTasks.every((t) => t.status === TaskStatus.DONE);

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
      select: { slot: true, plantTypeId: true },
    });

    // 每种最多 GARDEN_SET_SIZE 棵。不设这个上限的话，孩子种了 5 棵向日葵就再也凑不齐
    // "4 种 × 各 4 棵 = 16 格"这一整套了（5+4+4+4 = 17 > 16），会走进一个自己解不开的死局。
    const sameTypeAlive = alivePlants.filter((p) => p.plantTypeId === plantType.id).length;
    if (sameTypeAlive >= GARDEN_SET_SIZE) {
      throw new ActionError(`${plantType.title}已经种够 ${GARDEN_SET_SIZE} 棵啦，换一种试试`);
    }

    const occupied = new Set(alivePlants.map((p) => p.slot));
    let freeSlot = -1;
    for (let i = 0; i < GARDEN_SIZE; i++) {
      if (!occupied.has(i)) {
        freeSlot = i;
        break;
      }
    }
    if (freeSlot === -1) {
      throw new ActionError("花园已经种满啦，去收获它换阳光吧");
    }

    const plant = await tx.plant.create({
      data: {
        childId,
        plantTypeId: plantType.id,
        title: plantType.title,
        emoji: plantType.emoji,
        slot: freeSlot,
        status: PlantStatus.ALIVE,
        plantedOnDate: todayAsUtcDate(),
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

/** 已经收获过几轮花园。用 GARDEN_BONUS 流水条数来数，不需要在 Child 上额外存一个计数字段。 */
export async function getHarvestedRounds(childId: string): Promise<number> {
  return prisma.pointsLedger.count({
    where: { childId, type: LedgerType.GARDEN_BONUS },
  });
}

/**
 * 收获整座花园：集齐一整套（每种上架植物各 GARDEN_SET_SIZE 棵）之后，把所有植物一次性收走，
 * 按 GARDEN_HARVEST_MULTIPLIER 连本带利换成阳光，花园清空、开始新一轮。
 *
 * 植物不删除，而是标成 HARVESTED —— 和"被僵尸吃掉"区分开，历史记录完整保留；
 * 查"当前占用的格子"本来就只看 status = ALIVE，所以清空是自动的。
 *
 * 完成条件在事务内用 computeGardenProgress 重新算一遍（不信任页面传来的判断），
 * 并对 Child 行加锁，避免连点两次收获两份奖励。
 */
export async function harvestGarden(childId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const [activeTypes, alivePlants, previousRounds] = await Promise.all([
      tx.plantType.findMany({
        where: { childId, active: true },
        select: { id: true, title: true, emoji: true },
      }),
      tx.plant.findMany({
        where: { childId, status: PlantStatus.ALIVE },
        select: {
          id: true,
          plantTypeId: true,
          // 算收获奖励要知道这些植物当初花了多少，见 computeHarvestBonus
          ledgerEntry: { select: { amount: true } },
          plantType: { select: { cost: true } },
        },
      }),
      tx.pointsLedger.count({ where: { childId, type: LedgerType.GARDEN_BONUS } }),
    ]);

    const progress = computeGardenProgress(activeTypes, alivePlants);
    if (!progress.complete) {
      throw new ActionError("花园还没集齐，每种植物都要种够 4 棵才能收获");
    }

    const round = previousRounds + 1;
    // 奖励在事务内按实际存活的这批植物重算，不采信页面传来的数字
    const { spent, bonus } = computeHarvestBonus(alivePlants);

    await tx.plant.updateMany({
      where: { childId, status: PlantStatus.ALIVE },
      data: { status: PlantStatus.HARVESTED, harvestedAt: new Date() },
    });

    await tx.pointsLedger.create({
      data: {
        childId,
        amount: bonus,
        reason: `花园集齐一整套，收获奖励（第 ${round} 轮，成本 ${spent} 阳光）`,
        type: LedgerType.GARDEN_BONUS,
      },
    });

    return { round, spent, bonus };
  });
}
