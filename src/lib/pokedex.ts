import {
  BallTier,
  CaughtStatus,
  Gender,
  LedgerType,
  TaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  addDays,
  dateStringToUtcDate,
  formatStoredDate,
  todayAsUtcDate,
  todayDateString,
} from "@/lib/date";
import type { Annotated } from "@/components/Ruby";
import { ActionError } from "@/lib/errors";
import { annotate } from "@/lib/pinyin";
import { ensureDailyTasksForDate } from "@/lib/tasks";

/**
 * 宝可梦图鉴主题的核心逻辑。整体照着 lib/garden.ts 写的，一一对应：
 *   plantSeed             → throwBall（事务 + FOR UPDATE 锁 + 余额重查，防并发透支）
 *   settleGardenForChild  → settlePokedexForChild（懒结算、游标、幂等、一次性事件）
 *   花园集齐收获           → 图鉴里程碑（但图鉴是留着的，不清空）
 */

// 稀有度文案放在 lib/rarity.ts（无依赖，客户端组件也能安全引用），这里转出方便服务端代码使用
export { RARITY_LABELS } from "@/lib/rarity";

/**
 * 每次扔球先随机"遇到"哪一档的宝可梦，**遇怪表按球的等级变化**。
 *
 * 一开始所有球共用一张遇怪表，模拟 20 万次之后发现大师球是废的：它贵 24 倍，
 * 但抓到的东西和普通球一个分布（60% 都是普通货），花 120 阳光必中一只绿毛虫。
 * 好球必须同时改善"遇到什么"和"抓不抓得住"，才对得起价格，也才符合孩子的直觉——
 * 大师球就该是"攒很久、换一只真正想要的"。
 */
const ENCOUNTER_WEIGHTS: Record<BallTier, Record<number, number>> = {
  [BallTier.POKE]: { 1: 65, 2: 25, 3: 9, 4: 1 },
  [BallTier.GREAT]: { 1: 45, 2: 33, 3: 18, 4: 4 },
  [BallTier.ULTRA]: { 1: 25, 2: 33, 3: 32, 4: 10 },
  [BallTier.MASTER]: { 1: 5, 2: 15, 3: 45, 4: 35 },
};

/** 遇上之后的基础抓取率。这一层是"越厉害越难抓"的主要体现。 */
const BASE_CATCH_RATE: Record<number, number> = { 1: 0.7, 2: 0.45, 3: 0.22, 4: 0.08 };

/**
 * 保底：每失败一次，下一次的成功率 +25%；连续失败到这个次数就必中。
 * 一年级孩子攒一周的阳光连着空手会直接放弃，这条是为了兜住那种情况。
 */
export const PITY_BONUS_PER_MISS = 0.25;
export const PITY_GUARANTEE_AT = 5;

/** 抓取率的上下限：留 5% 的意外，也不让普通球变成必中。大师球单独走 100%。 */
const MIN_CATCH_RATE = 0.05;
const MAX_CATCH_RATE = 0.95;

/** 闪光个体的概率，沿用原作的 1/64（比原作 1/4096 高很多，不然孩子一辈子见不到一只）。 */
const SHINY_RATE = 1 / 64;

/** 图鉴里程碑：每集齐这么多**不同种类**发一次奖励。 */
export const POKEDEX_MILESTONE_STEP = 8;
export const POKEDEX_MILESTONE_BONUS = 30;

/**
 * 扔球的结果。文案在这里就用 annotate() **在服务端**标好拼音再返回。
 *
 * 原因：结果要在客户端组件里渲染，而算拼音的 pinyin-pro 带着一整本字典、不能进浏览器包
 * （见 components/Ruby 的注释）。抓到的是 151 只里的哪一只只有运行时才知道，
 * 没法在页面上预渲染，所以只能由这个跑在服务端的函数把标注一起带回去。
 */
export type ThrowResult =
  | {
      outcome: "CAUGHT";
      rarity: number;
      artUrl: string;
      /** "抓到了！皮卡丘" */
      title: Annotated;
      /** 保底兜住 / 里程碑奖励之类的补充说明，没有就是空数组 */
      notes: Annotated[];
    }
  | {
      outcome: "FLED";
      rarity: number;
      artUrl: string;
      /** "皮卡丘 跑掉了" */
      title: Annotated;
      notes: Annotated[];
    };

export type PokedexEvent =
  | { date: string; outcome: "FLED_AWAY"; nameZh: string; artUrl: string }
  | { date: string; outcome: "NOTHING_TO_LOSE" };

/** 按该等级球的遇怪表随机挑一档稀有度。导出是为了能跑大样本模拟验证。 */
export function rollRarity(tier: BallTier): number {
  const table = ENCOUNTER_WEIGHTS[tier];
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(table)) {
    roll -= weight;
    if (roll <= 0) return Number(rarity);
  }
  return 1;
}

/** genderRate：-1 无性别；否则是"母的比例 / 8"。 */
function rollGender(genderRate: number): Gender {
  if (genderRate < 0) return Gender.UNKNOWN;
  return Math.random() < genderRate / 8 ? Gender.FEMALE : Gender.MALE;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * 算这一次的抓取成功率。抽成纯函数是为了能直接跑大样本模拟验证概率，
 * 不用真的去操作数据库。
 */
export function catchProbability(rarity: number, catchPower: number, missStreak: number): number {
  if (missStreak >= PITY_GUARANTEE_AT) return 1;
  const base = BASE_CATCH_RATE[rarity] ?? 0.5;
  const withPity = base * catchPower * (1 + missStreak * PITY_BONUS_PER_MISS);
  return Math.min(MAX_CATCH_RATE, Math.max(MIN_CATCH_RATE, withPity));
}

/**
 * 扔一个球。
 *
 * 事务内 + 对 Child 行加 FOR UPDATE 锁 + 重新聚合余额，写法和 lib/garden.ts 的
 * plantSeed 完全一致——孩子连点两次不能扣两次阳光。
 * 成功率和保底都在事务里算，不采信页面传来的任何东西。
 */
export async function throwBall(ballTypeId: string, childId: string): Promise<ThrowResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");

    const ball = await tx.ballType.findUnique({ where: { id: ballTypeId } });
    if (!ball || ball.childId !== childId || !ball.active) {
      throw new ActionError("这种精灵球现在买不了");
    }

    const balanceResult = await tx.pointsLedger.aggregate({
      where: { childId },
      _sum: { amount: true },
    });
    if ((balanceResult._sum.amount ?? 0) < ball.cost) {
      throw new ActionError("阳光还不够哦");
    }

    // 先扣钱：球一旦扔出去就消耗掉了，抓没抓到都一样
    await tx.pointsLedger.create({
      data: {
        childId,
        amount: -ball.cost,
        reason: `购买${ball.title}`,
        type: LedgerType.BALL_BUY,
      },
    });

    // 遇到一只：先按这个球的遇怪表摇稀有度档，再在那一档里随机挑一只
    const rarity = rollRarity(ball.tier);
    const pool = await tx.pokemonSpecies.findMany({ where: { rarity } });
    // 理论上不会空（151 只四档都有），真空了就退回全库，别让孩子白花阳光
    const species = pick(pool.length > 0 ? pool : await tx.pokemonSpecies.findMany());
    if (!species) throw new ActionError("图鉴还没准备好，请家长先导入宝可梦数据");

    const isMaster = ball.tier === BallTier.MASTER;
    const missStreak = child.catchMissStreak;
    const probability = isMaster ? 1 : catchProbability(species.rarity, ball.catchPower, missStreak);
    const byPity = !isMaster && missStreak >= PITY_GUARANTEE_AT;

    if (Math.random() >= probability) {
      await tx.child.update({
        where: { id: childId },
        data: { catchMissStreak: missStreak + 1 },
      });
      const nextStreak = missStreak + 1;
      const guaranteedIn = Math.max(0, PITY_GUARANTEE_AT - nextStreak);
      return {
        outcome: "FLED",
        rarity: species.rarity,
        artUrl: species.artUrl,
        title: annotate(`${species.nameZh} 跑掉了`),
        notes: [
          annotate(
            guaranteedIn > 0
              ? `下次运气 +${Math.round(nextStreak * PITY_BONUS_PER_MISS * 100)}%，再失败 ${guaranteedIn} 次一定抓到`
              : "下一次一定抓得到！"
          ),
        ],
      };
    }

    // 抓到了。所有展示字段都快照下来，之后图鉴库更新也不影响这一只。
    await tx.caught.create({
      data: {
        childId,
        speciesId: species.id,
        nameZh: species.nameZh,
        types: species.types,
        rarity: species.rarity,
        artUrl: species.artUrl,
        gender: rollGender(species.genderRate),
        ability: species.abilities.length > 0 ? pick(species.abilities) : "未知",
        moveName: species.moveName,
        movePower: species.movePower,
        hp: species.hp,
        attack: species.attack,
        defense: species.defense,
        speed: species.speed,
        isShiny: Math.random() < SHINY_RATE,
        ballTypeId: ball.id,
        ballTier: ball.tier,
        caughtOnDate: todayAsUtcDate(),
      },
    });
    await tx.child.update({ where: { id: childId }, data: { catchMissStreak: 0 } });

    // 里程碑按**不同种类**数算，重复抓同一只不推进进度
    const distinct = await tx.caught.findMany({
      where: { childId, status: CaughtStatus.OWNED },
      select: { speciesId: true },
      distinct: ["speciesId"],
    });
    const total = distinct.length;
    let newMilestone: { total: number; bonus: number } | null = null;

    if (total > 0 && total % POKEDEX_MILESTONE_STEP === 0) {
      // 用 reason 里的种类数做幂等标记：同一个里程碑只发一次，
      // 就算孩子放生又抓回来把数字凑到同一个数，也不会重复发。
      const marker = `图鉴集齐 ${total} 种`;
      const already = await tx.pointsLedger.findFirst({
        where: { childId, type: LedgerType.POKEDEX_BONUS, reason: { startsWith: marker } },
      });
      if (!already) {
        await tx.pointsLedger.create({
          data: {
            childId,
            amount: POKEDEX_MILESTONE_BONUS,
            reason: `${marker}，收集奖励`,
            type: LedgerType.POKEDEX_BONUS,
          },
        });
        newMilestone = { total, bonus: POKEDEX_MILESTONE_BONUS };
      }
    }

    const notes: Annotated[] = [];
    if (byPity) notes.push(annotate("坚持了这么多次，这只是你应得的"));
    if (newMilestone) {
      notes.push(
        annotate(`集齐 ${newMilestone.total} 种，奖励 ${newMilestone.bonus} 阳光`)
      );
    }

    return {
      outcome: "CAUGHT",
      rarity: species.rarity,
      artUrl: species.artUrl,
      title: annotate(`抓到了！${species.nameZh}`),
      notes,
    };
  });
}

/**
 * 纪律循环：任务没完成的日子，有一只宝可梦离家出走。
 * 对应花园主题里"僵尸吃掉一棵植物"，逻辑逐条对齐 settleGardenForChild：
 *   - 从游标次日逐天判定到"昨天"（今天没过完不判）
 *   - 先 ensureDailyTasksForDate 回填，堵住"不开 App 就躲过判定"
 *   - 当天抓到过宝可梦 → 免疫（对应"当天种了植物免疫"）
 *   - 整个函数一个事务 + FOR UPDATE 锁，幂等；游标推进后重复调用返回空数组
 *
 * 和花园共用 Child.gardenSettledThrough 这个游标——主题互斥，一个孩子只跑一套。
 */
export async function settlePokedexForChild(childId: string): Promise<PokedexEvent[]> {
  const todayStr = todayDateString();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");

    let cursor = child.gardenSettledThrough
      ? addDays(formatStoredDate(child.gardenSettledThrough), 1)
      : todayDateString(child.createdAt);

    const events: PokedexEvent[] = [];
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
      const caughtThatDay = await tx.caught.count({
        where: { childId, caughtOnDate: dateStringToUtcDate(cursor) },
      });

      const isSafe =
        caughtThatDay > 0 ||
        dayTasks.length === 0 ||
        dayTasks.every((t) => t.status === TaskStatus.DONE);

      if (!isSafe) {
        const owned = await tx.caught.findMany({
          where: { childId, status: CaughtStatus.OWNED },
        });
        if (owned.length === 0) {
          events.push({ date: cursor, outcome: "NOTHING_TO_LOSE" });
        } else {
          const chosen = pick(owned);
          await tx.caught.update({
            where: { id: chosen.id },
            data: { status: CaughtStatus.FLED, fledOnDate: dateStringToUtcDate(cursor) },
          });
          events.push({
            date: cursor,
            outcome: "FLED_AWAY",
            nameZh: chosen.nameZh,
            artUrl: chosen.artUrl,
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
