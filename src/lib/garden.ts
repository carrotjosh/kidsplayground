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

/**
 * 花园分级：第 N 级是 side×side 的格子，需要 side 种植物、每种各 side 棵。
 *
 * 一个数字同时定死三件事（边长 / 种类数 / 每种棵数），这不是巧合而是约束：
 * "每种各 K 棵 × M 种 = 格子总数"必须成立，否则孩子要么轻松集齐、要么永远集不齐。
 * 取 M = K = side 是唯一能让格子刚好铺满的自然解。
 *
 * **为什么要分级。** 原来永远是 4×4、永远那四种植物，第 2 轮和第 20 轮一模一样，
 * 孩子玩三轮就腻了——图鉴那边已经有 386 只 + 分地区解锁撑着六年，花园却零长期内容。
 * 每升一级多解锁一种植物、格子多一圈，成本按平方长（272 → 540 → 978），
 * 难度和成就感自然递升。
 *
 * 想加第 4 级只要往这个数组里加一个 7，再在 bootstrap.ts 里补一种植物、
 * 给 PlantSprite 画一张图就行。
 */
export const GARDEN_STAGES = [4, 5, 6] as const;

/** 收获多少轮升一级。 */
export const HARVEST_ROUNDS_PER_STAGE = 3;

/** 第 stage 级花园的边长。越界的 stage 一律夹到合法范围，不抛错。 */
export function gardenSide(stage: number): number {
  return GARDEN_STAGES[Math.min(Math.max(stage, 1), GARDEN_STAGES.length) - 1];
}

/** 第 stage 级花园一共几个格子。 */
export function gardenSize(stage: number): number {
  const side = gardenSide(stage);
  return side * side;
}

/** 第 stage 级每种植物要种够几棵（= 边长 = 需要的植物种类数）。 */
export function gardenSetSize(stage: number): number {
  return gardenSide(stage);
}

/**
 * 收获奖励 = 每棵植物的成本 × (1 + 每天利息 × 它活了多少天)，利息最多算 MAX 天。
 *
 * **为什么不是一个固定倍率。** 原来是"成本 × 1.5"，一次性给。那样有个致命漏洞：
 * 收获会清空全部格子，而种植和收获都没有天数限制，所以余额一旦够种满一园，
 * 就能在同一次操作里「种满 16 棵 → 收获 → 再种满 → 再收获」无限循环，
 * 每圈净赚 50%。孩子只要发现一次，整个阳光经济就废了。
 *
 * 改成按天计息之后，"当天种当天收"的利息是 0，收获恰好等于成本，刷循环收益归零；
 * 而正常玩法（边攒边种，十天左右集齐一园）自然拿到接近 1.5 倍——
 * 和改之前的手感一样，只是现在这 50% 是**真的用时间换来的**。
 *
 * 这也让注释里一直宣称的那句话第一次成立：这是"把阳光锁在花园里的利息"。
 * 锁得越久利息越多，中途任务没做完被僵尸吃掉，那棵的本金和利息一起没。
 */
export const HARVEST_DAILY_INTEREST = 0.05;
export const HARVEST_MAX_INTEREST_DAYS = 10;

/** 一棵植物最多能拿到的倍率，给界面文案用。 */
export const HARVEST_MAX_MULTIPLIER = 1 + HARVEST_DAILY_INTEREST * HARVEST_MAX_INTEREST_DAYS;

type HarvestablePlant = {
  ledgerEntry?: { amount: number } | null;
  plantType?: { cost: number } | null;
  plantedOnDate?: Date | null;
};

/** 这棵植物到 onDate 为止活了几天（封顶到计息上限）。 */
function interestDays(plantedOnDate: Date | null | undefined, onDate: string): number {
  if (!plantedOnDate) return 0;
  const planted = Date.parse(`${formatStoredDate(plantedOnDate)}T00:00:00Z`);
  const now = Date.parse(`${onDate}T00:00:00Z`);
  const days = Math.floor((now - planted) / 86_400_000);
  return Math.min(Math.max(days, 0), HARVEST_MAX_INTEREST_DAYS);
}

/**
 * 算一园植物值多少收获奖励。
 *
 * 成本取的是当初那条 PLANT_SEED 流水（种下时真的扣了多少），不是植物目录上的现价——
 * 家长中途改价、甚至把品种删了，都不该影响已经种下去的这些植物值多少钱。
 * 万一流水缺失（比如脚本直接造的测试数据），退回用目录现价兜底。
 *
 * 只在总额上取整一次。逐棵取整的话 16 棵能白捡十几点阳光。
 */
export function computeHarvestBonus(
  plants: HarvestablePlant[],
  onDate: string = todayDateString()
): { spent: number; bonus: number; interestDays: number } {
  let spent = 0;
  let gross = 0;
  let daySum = 0;
  for (const plant of plants) {
    const cost = Math.abs(plant.ledgerEntry?.amount ?? plant.plantType?.cost ?? 0);
    const days = interestDays(plant.plantedOnDate, onDate);
    spent += cost;
    daySum += days;
    gross += cost * (1 + HARVEST_DAILY_INTEREST * days);
  }
  return {
    spent,
    bonus: Math.ceil(gross),
    // 平均计息天数，用来在页面上解释"再等几天更值"
    interestDays: plants.length > 0 ? Math.round(daySum / plants.length) : 0,
  };
}

export type GardenEvent =
  | {
      date: string;
      outcome: "PLANT_EATEN";
      plantTitle: string;
      plantEmoji: string | null;
      /** 被吃的是不是"当天刚种下、挡在最前面"的那棵 */
      shielded: boolean;
    }
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
  /** 每个上架品种都种够 setSize 棵 —— 可以收获了 */
  complete: boolean;
  /** 花园里还活着、但已经不属于当前目标的植物棵数（品种被家长下架或删掉了），它们照样占格子 */
  strayAlive: number;
  /** 一整套 + 那些占着格子的"编外"植物，能不能塞进这一级的格子里 */
  achievable: boolean;
  /** 现在园子里这些植物一共花了多少阳光 */
  spent: number;
  /** 现在收获能拿多少（集齐前也算出来给孩子看，知道攒下去值多少） */
  bonus: number;
  /** 这一园植物的平均计息天数，用来告诉孩子"再等等更值" */
  interestDays: number;
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
  stage: number,
  activeTypes: { id: string; title: string; emoji: string | null }[],
  alivePlants: {
    plantTypeId: string | null;
    ledgerEntry?: { amount: number } | null;
    plantType?: { cost: number } | null;
    plantedOnDate?: Date | null;
  }[]
): GardenProgress {
  const setSize = gardenSetSize(stage);
  const size = gardenSize(stage);
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
    needed: setSize,
  }));

  const { spent, bonus, interestDays } = computeHarvestBonus(alivePlants);

  return {
    entries,
    complete: entries.length > 0 && entries.every((e) => e.alive >= e.needed),
    strayAlive,
    achievable:
      entries.length > 0 && entries.length * setSize + strayAlive <= size,
    spent,
    bonus,
    interestDays,
  };
}

/**
 * 懒结算花园：从 gardenSettledThrough 的次日开始，逐天判定到"昨天"为止（今天永远不判，
 * 因为今天还没过完）。某一天"算不算安全"：
 *   - 先回填那天缺失的周期任务（防止"不开 App 就躲过判定"）；
 *   - 该天有任务（排除 CANCELLED）且全部 DONE 才算安全；
 *   - 当天种没种植物**不影响**判定，只影响僵尸先吃哪一棵（见下面的注释）；
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

      // 只看任务。**当天种了植物不再等于免疫**——原来是免疫的，但收获会把 16 个格子
      // 全部清空、永远有空位，所以"一天种一棵最便宜的向日葵"就能永久免疫，
      // 而那 8 阳光收获时还连本带利还回来，等于免疫是负成本白送，
      // "任务没做完会有后果"这条规则实际上根本不存在。
      const isSafe = dayTasks.length === 0 || dayTasks.every((t) => t.status === TaskStatus.DONE);

      if (!isSafe) {
        const alivePlants = await tx.plant.findMany({
          where: { childId, status: PlantStatus.ALIVE },
        });

        if (alivePlants.length === 0) {
          events.push({ date: cursor, outcome: "GARDEN_EMPTY" });
        } else {
          // 当天刚种下的那棵挡在最前面，先被吃。
          // 保留了"新种的植物能挡一下"这层植物大战僵尸的味道，但代价是真的——
          // 挡下来的是那棵新植物本身，不再是凭空免疫。
          const cursorDate = dateStringToUtcDate(cursor).getTime();
          const freshlyPlanted = alivePlants.filter(
            (p) => p.plantedOnDate?.getTime() === cursorDate
          );
          const pool = freshlyPlanted.length > 0 ? freshlyPlanted : alivePlants;
          const chosen = pool[Math.floor(Math.random() * pool.length)];
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
            shielded: freshlyPlanted.length > 0,
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

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");
    const setSize = gardenSetSize(child.gardenStage);
    const size = gardenSize(child.gardenStage);

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

    // 每种最多 setSize 棵。不设这个上限的话，孩子种了 5 棵向日葵就再也凑不齐
    // "4 种 × 各 4 棵 = 16 格"这一整套了（5+4+4+4 = 17 > 16），会走进一个自己解不开的死局。
    const sameTypeAlive = alivePlants.filter((p) => p.plantTypeId === plantType.id).length;
    if (sameTypeAlive >= setSize) {
      throw new ActionError(`${plantType.title}已经种够 ${setSize} 棵啦，换一种试试`);
    }

    const occupied = new Set(alivePlants.map((p) => p.slot));
    let freeSlot = -1;
    for (let i = 0; i < size; i++) {
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

/**
 * 够条件就把花园升一级：多一圈格子、多解锁一种植物。
 *
 * 和图鉴的 checkRegionUnlock 同构，包括调用时机——**必须在页面渲染之前调**，
 * 否则孩子这一次看到的还是旧尺寸的花园，升级那个瞬间就没了。
 *
 * 一个刻意的保守判断：**没有可以解锁的新植物就不升级**。
 * 升级会把"需要几种植物"从 4 变成 5，如果目录里凑不出第 5 种（家长把备用品种删了），
 * 升上去的花园就永远集不齐——那是个孩子自己解不开的死局，宁可停在当前这一级。
 */
export async function checkGardenStageUp(
  childId: string
): Promise<{ stage: number; side: number; unlockedPlant: string } | null> {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { gardenStage: true },
  });
  if (!child) return null;
  if (child.gardenStage >= GARDEN_STAGES.length) return null;

  const rounds = await getHarvestedRounds(childId);
  if (rounds < child.gardenStage * HARVEST_ROUNDS_PER_STAGE) return null;

  // 解锁最便宜的那个还没上架的品种。默认目录里新品种就是更贵的那些，
  // 所以按价格升序拿正好等于"按设计顺序解锁"。
  const next = await prisma.plantType.findFirst({
    where: { childId, active: false },
    orderBy: { cost: "asc" },
  });
  if (!next) return null;

  // 带上当前级数做条件，两个请求同时触发时只有一个能改到，不会一次跳两级
  const updated = await prisma.child.updateMany({
    where: { id: childId, gardenStage: child.gardenStage },
    data: { gardenStage: child.gardenStage + 1 },
  });
  if (updated.count === 0) return null;

  await prisma.plantType.update({ where: { id: next.id }, data: { active: true } });

  const stage = child.gardenStage + 1;
  return { stage, side: gardenSide(stage), unlockedPlant: next.title };
}

/**
 * 花园之路：每一级多大、要收获几轮才到、会解锁哪种植物。
 *
 * 和等级之路是**两条独立的线**：等级看累计打卡挣的阳光，花园看收获了几轮。
 * 不合并是因为叠两套门槛之后，"我到底什么时候能拿到寒冰射手"就说不清了。
 * 但孩子同样需要看见花园这条线的尽头，所以单独给一份。
 */
export type GardenRoadmapEntry = {
  stage: number;
  side: number;
  size: number;
  /** 到这一级需要累计收获几轮 */
  needRounds: number;
  unlocks: { title: string; emoji: string | null }[];
  reached: boolean;
  current: boolean;
};

export async function getGardenRoadmap(
  childId: string,
  stage: number
): Promise<GardenRoadmapEntry[]> {
  // 解锁顺序 = 价格升序（见 lib/bootstrap.ts 的 DEFAULT_PLANT_TYPES 注释）
  const types = await prisma.plantType.findMany({
    where: { childId },
    select: { title: true, emoji: true },
    orderBy: { cost: "asc" },
  });

  return GARDEN_STAGES.map((side, i) => {
    const stageNo = i + 1;
    // 第 1 级用掉前 gardenSetSize(1) 种，之后每级多用一种
    const from = i === 0 ? 0 : gardenSetSize(1) + i - 1;
    const to = gardenSetSize(1) + i;
    return {
      stage: stageNo,
      side,
      size: side * side,
      needRounds: i * HARVEST_ROUNDS_PER_STAGE,
      unlocks: types.slice(from, to).map((t) => ({ title: t.title, emoji: t.emoji })),
      reached: stageNo <= stage,
      current: stageNo === stage,
    };
  });
}

/** 已经收获过几轮花园。用 GARDEN_BONUS 流水条数来数，不需要在 Child 上额外存一个计数字段。 */
export async function getHarvestedRounds(childId: string): Promise<number> {
  return prisma.pointsLedger.count({
    where: { childId, type: LedgerType.GARDEN_BONUS },
  });
}

/**
 * 收获整座花园：集齐一整套（每种上架植物各 gardenSetSize 棵）之后，把所有植物一次性收走，
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

    const child = await tx.child.findUniqueOrThrow({ where: { id: childId } });

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
          // 算收获奖励要知道这些植物当初花了多少、活了多久，见 computeHarvestBonus
          ledgerEntry: { select: { amount: true } },
          plantType: { select: { cost: true } },
          plantedOnDate: true,
        },
      }),
      tx.pointsLedger.count({ where: { childId, type: LedgerType.GARDEN_BONUS } }),
    ]);

    const progress = computeGardenProgress(child.gardenStage, activeTypes, alivePlants);
    if (!progress.complete) {
      throw new ActionError(
        `花园还没集齐，每种植物都要种够 ${gardenSetSize(child.gardenStage)} 棵才能收获`
      );
    }

    const round = previousRounds + 1;
    // 奖励在事务内按实际存活的这批植物重算，不采信页面传来的数字
    const { spent, bonus, interestDays } = computeHarvestBonus(alivePlants);

    await tx.plant.updateMany({
      where: { childId, status: PlantStatus.ALIVE },
      data: { status: PlantStatus.HARVESTED, harvestedAt: new Date() },
    });

    await tx.pointsLedger.create({
      data: {
        childId,
        amount: bonus,
        reason: `花园集齐一整套，收获奖励（第 ${round} 轮，成本 ${spent} 阳光，平均养了 ${interestDays} 天）`,
        type: LedgerType.GARDEN_BONUS,
      },
    });

    return { round, spent, bonus, interestDays };
  });
}
