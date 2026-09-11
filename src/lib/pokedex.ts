import {
  BallTier,
  CaughtStatus,
  Gender,
  LedgerType,
  TaskStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  dailyEarnRate,
  duplicateRefund,
  pokedexMilestoneBonus,
  refreshCosts,
  speciesMasteryBonus,
} from "@/lib/economy";
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

/** 每天出现几只。 */
export const DAILY_ENCOUNTER_COUNT = 2;

/** 每只最多能扔几个球，用完就跑掉，明天换一批。 */
export const MAX_ATTEMPTS_PER_ENCOUNTER = 3;

/**
 * 每天生成遇怪名单时，各稀有度出现的权重。**只有一张表，和球的等级无关**。
 *
 * 历史：之前是每种球一张遇怪表（好球更容易遇到稀有的），那是为了救大师球——
 * 当时孩子看不到会遇到什么，大师球就只是"贵 24 倍的必中"，模拟 20 万次发现
 * 它抓到的分布和普通球一样，花 120 阳光必中一只绿毛虫。
 *
 * 现在名单每天公开、孩子自己挑目标，那一层补丁就不需要了：看到传说宝可梦才掏大师球，
 * 这本来就是大师球该有的用法。球的等级从此只影响"抓不抓得住"。
 *
 * 数值按"每天 2 只"配的：
 *   至少一只稀有以上 = 1 - 0.85² ≈ 28%（三四天一次）
 *   至少一只传说     = 1 - 0.98² ≈ 4%（一个月一次左右）
 */
const ENCOUNTER_WEIGHTS: Record<number, number> = { 1: 55, 2: 30, 3: 13, 4: 2 };

/**
 * 遇上之后的基础抓取率。这一层是"越厉害越难抓"的主要体现。
 *
 * 调过两轮。初版 0.7/0.45/0.22/0.08 太松：3 个普通球抓普通 100%、少见 92%，
 * 高级球打少见直接顶到 95% 的上限，"选哪个球"根本不用想。
 * 第二版 0.4/0.2/0.09/0.03 又偏紧了一点，于是回调到现在这组。
 *
 * 现在 3 个普通球（24 阳光）大致是：普通 95% / 少见 68% / 稀有 39% / 传说 14%。
 * 手感是"普通的基本能拿下、少见的常有遗憾、稀有的要碰运气、传说的得靠大师球"。
 */
export const BASE_CATCH_RATE: Record<number, number> = { 1: 0.5, 2: 0.25, 3: 0.12, 4: 0.04 };

/**
 * 保底：每失败一次，下一次的成功率 +25%；连续失败到这个次数就必中。
 * 一年级孩子攒一周的阳光连着空手会直接放弃，这条是为了兜住那种情况。
 */
export const PITY_BONUS_PER_MISS = 0.25;
export const PITY_GUARANTEE_AT = 5;

/**
 * 抓取率的上下限。大师球单独走 100%，不受这里限制。
 *
 * 下限压到 2%：原来是 5%，结果传说那一档 0.03×1（精灵球）和 0.03×1.6（超级球）
 * 双双被抬到 5%，两种球的数字一模一样——花 20 还是花 8 完全没区别，
 * "选哪个球"这个决策在最该有意义的地方失效了。
 */
const MIN_CATCH_RATE = 0.02;
const MAX_CATCH_RATE = 0.95;

/** 闪光个体的概率，沿用原作的 1/64（比原作 1/4096 高很多，不然孩子一辈子见不到一只）。 */
const SHINY_RATE = 1 / 64;

/**
 * 抓到已经有的那一种，按稀有度返还的阳光。
 *
 * 为什么需要：模拟一年发现，**第 2 个月就有 37% 的捕获是重复的、第 3 个月过半**，
 * 而重复原本什么都不给（不算里程碑、不给阳光）——"又是这只"会直接消掉抓的动力。
 * 151 种的图鉴迟早会走到"几乎全是重复"，这是有限收集必然的终局，
 * 所以出路不是让新种类更多，而是让每一次成功都值点什么。
 *
 * 数值刻意压在球价（最便宜 8 阳光）之下，保证扔球**永远不可能是赚钱手段**：
 * 最划算的情况是普通球打稀有重复，期望 0.12 × 20 = 2.4 阳光，远低于 8 的成本。
 * 球价是家长可改的，所以这条不变量在 lib/economyAudit.ts 里有实时校验，不只靠这里的数值。
 */
/* 具体数值改成按日薪算了，见 lib/economy.ts 的 duplicateRefund（日薪 25 时正好还是 3/8/20/60）。 */

/**
 * 生成遇怪时，优先挑"还没抓到过"的那一种的概率。
 *
 * 只加在同一稀有度档**内部**：先按 ENCOUNTER_WEIGHTS 摇档次（保证稀有度分布不变），
 * 再在档内偏向没见过的。模拟下来前三个月的重复率从 37%/52% 降到 21%/33%，
 * 新手期的新鲜感明显好转；中后期反而略高，因为收集得更快、剩的更少——
 * 那一段由重复返还（economy.ts 的 duplicateRefund）兜着。
 *
 * 不设成 1：留一点重复才符合"可以重复抓同一种"的设定，孩子也会有再遇到心头好的惊喜。
 */
const UNSEEN_BIAS = 0.5;

/**
 * 同一种攒够这么多只，就算"这一种收集完成"，发一次奖励。越普通的要越多只。
 *
 * 阈值是按模拟定的，不是拍脑袋：跑一年下来，同一种最多能攒到
 * 普通 9.8 / 少见 6.4 / 稀有 2.5 / 传说 0.9 只。
 * 所以普通设 5（几个月内能完成好几种）、稀有设 3（要大半年，属于长期目标）、
 * 传说设 2（基本是终极成就）。设成 10/6/4/2 那种直觉数字的话，稀有和传说永远够不到。
 */
const SPECIES_MASTERY_GOAL: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2 };

/* 完成一种的奖励跟难度走，具体数值见 lib/economy.ts 的 speciesMasteryBonus。 */

/** 某个稀有度要攒几只才算收集完成，给页面显示进度用。 */
export function masteryGoal(rarity: number): number {
  return SPECIES_MASTERY_GOAL[rarity] ?? 5;
}

/**
 * 花阳光刷新今天遇到的宝可梦。**递增计价**，一天最多刷 3 次。
 *
 * 为什么要有：每天只出 2 只，运气差的时候两只都是已经集满的普通货，
 * 孩子当天除了干等没别的事可做——有偿刷新给了他一个"主动改变局面"的选项。
 *
 * 为什么递增（日薪 25 时是 5 → 13 → 25）：平价的话孩子会无脑连刷到出稀有的，
 * 抓宝就退化成了刷新。第一次比一个精灵球（8）还便宜，愿意试；
 * 第三次 25 阳光正好是一整天的收入，得真的想清楚。三次全刷 42 阳光，要动用存款。
 *
 * 不怕被拿来刷传说：3 次刷新多摇 6 次遇怪，撞上传说的概率从 4% 提到约 11%，
 * 但抓传说还得再掏 200 的大师球，整体算下来一点都不便宜。
 */
export const MAX_REFRESHES_PER_DAY = 3;

/**
 * 图鉴按**打卡等级**开放到第几号。
 *
 * 从"收集到当前地区的 80% 就开下一个"改成挂在等级上，原因是那个触发条件
 * 奖励的是**在游戏里刷**（多买球多抓），而不是**打卡**。内容是这套系统里最硬的
 * 激励，它应该由"干了多少活"决定——等级正是那个量（见 lib/level.ts）。
 * 顺带三条独立的进度线（等级 / 图鉴收集率 / 花园收获轮数）合并成了一条。
 *
 * **下限必须 ≥151**：第一只传说宝可梦是 #144（急冻鸟），上限低于它的话
 * 传说那一档一只都没有，摇到传说时会退回随机挑一只普通的——稀有度体系静默失效。
 * 所以第 1 级直接给满关都，往后每级放出约 17 只。
 *
 * 三个地区边界落在 Lv.1 / Lv.7 / Lv.15，中间每一级也都有新面孔，
 * 这样"等级之路"上每一行都有内容，而不是只有三行有。
 */
export const SPECIES_CEILING_BY_LEVEL = [
  151, 170, 188, 205, 222, 238, 251, 268, 285, 302, 318, 334, 350, 368, 386,
] as const;

/** 地区名和它的编号上界，用来在界面上标"这一批属于哪个地区"。 */
export const REGIONS = [
  { name: "关都", ceiling: 151 },
  { name: "城都", ceiling: 251 },
  { name: "丰缘", ceiling: 386 },
] as const;

/** 第 level 级能遇到的最大图鉴编号。越界一律夹到合法范围。 */
export function speciesCeilingForLevel(level: number): number {
  const i = Math.min(Math.max(level, 1), SPECIES_CEILING_BY_LEVEL.length) - 1;
  return SPECIES_CEILING_BY_LEVEL[i];
}

/** 这个编号上界落在哪个地区里（用来显示"关都地区已经收集…"）。 */
export function regionAt(ceiling: number): string {
  return (REGIONS.find((r) => ceiling <= r.ceiling) ?? REGIONS[REGIONS.length - 1]).name;
}

/** 图鉴里程碑：每集齐这么多**不同种类**发一次奖励。金额见 lib/economy.ts 的 pokedexMilestoneBonus（4 天工资）。 */
export const POKEDEX_MILESTONE_STEP = 8;

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
      /** "抓到了！皮卡丘" */
      title: Annotated;
      /** 保底兜住 / 里程碑奖励之类的补充说明，没有就是空数组 */
      notes: Annotated[];
    }
  | {
      outcome: "FLED";
      rarity: number;
      /** "皮卡丘 跑掉了" */
      title: Annotated;
      notes: Annotated[];
    };

export type PokedexEvent =
  | { date: string; outcome: "FLED_AWAY"; nameZh: string }
  | { date: string; outcome: "NOTHING_TO_LOSE" };

/** 按遇怪表随机挑一档稀有度。导出是为了能跑大样本模拟验证。 */
export function rollRarity(): number {
  const total = Object.values(ENCOUNTER_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(ENCOUNTER_WEIGHTS)) {
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
  // 保底的必中**不适用于传说**：每只只有 3 次机会、传说一个月才出一次，
  // 要是连续失败 5 次就能用 8 阳光的普通球必中传说，200 阳光的大师球立刻变废物。
  // 传说仍然吃 +25%/次 的加成，只是没有硬保底——要么运气，要么大师球。
  if (missStreak >= PITY_GUARANTEE_AT && rarity < 4) return 1;
  const base = BASE_CATCH_RATE[rarity] ?? 0.5;
  const withPity = base * catchPower * (1 + missStreak * PITY_BONUS_PER_MISS);
  return Math.min(MAX_CATCH_RATE, Math.max(MIN_CATCH_RATE, withPity));
}

/**
 * 生成"今天遇到的"名单，一天只生成一次（靠 @@unique([childId, date, slot]) + skipDuplicates
 * 保证幂等，同 ensureDailyTasksForDate 的做法）。
 *
 * 必须落库而不是每次现摇：孩子能看到名单才谈得上"决定用什么球"，
 * 而如果每次刷新都重摇，他只要一直刷新就能刷出传说宝可梦。
 *
 * 个体属性（性别/特性/闪光）在这里就摇好：孩子看到的那只必须就是他会抓到的那只，
 * 否则"看到闪光才舍得用大师球"这个决策是假的。
 */
export async function ensureTodayEncounters(childId: string, dateString: string) {
  const date = dateStringToUtcDate(dateString);

  const existing = await prisma.dailyEncounter.count({ where: { childId, date } });
  if (existing >= DAILY_ENCOUNTER_COUNT) return;

  await createEncounters(childId, dateString, DAILY_ENCOUNTER_COUNT - existing, 0, existing);
}

/**
 * 造 count 只新的遇怪。自动生成和有偿刷新共用这一段，保证两边摇出来的分布一模一样。
 * slot 从 startSlot 往后排，靠 @@unique([childId, date, slot]) 防重复。
 */
async function createEncounters(
  childId: string,
  dateString: string,
  count: number,
  refreshRound: number,
  startSlot: number
) {
  if (count <= 0) return;
  const date = dateStringToUtcDate(dateString);

  // 只从等级已经放出来的那一段里挑（见 SPECIES_CEILING_BY_LEVEL）。
  // 上限一路传进 findMany 的 where，而不是查完再 filter——不然会白查几百行。
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { level: true },
  });
  const ceiling = speciesCeilingForLevel(child?.level ?? 1);

  const ownedSpeciesIds = new Set(
    (
      await prisma.caught.findMany({
        where: { childId, status: CaughtStatus.OWNED },
        select: { speciesId: true },
        distinct: ["speciesId"],
      })
    ).map((c) => c.speciesId)
  );

  const rows = [];
  for (let slot = startSlot; slot < startSlot + count; slot++) {
    const rarity = rollRarity();
    const pool = await prisma.pokemonSpecies.findMany({
      where: { rarity, id: { lte: ceiling } },
    });
    // 理论上四档都有货（关都是 63/39/43/6），真空了退回本地区全部，别让孩子看到空名单
    const candidates =
      pool.length > 0
        ? pool
        : await prisma.pokemonSpecies.findMany({ where: { id: { lte: ceiling } } });
    if (candidates.length === 0) {
      throw new ActionError("图鉴还没准备好，请家长先导入宝可梦数据");
    }
    // 档内偏向没抓到过的（见 UNSEEN_BIAS）。稀有度分布不受影响，只影响档内挑谁。
    const unseen = candidates.filter((c) => !ownedSpeciesIds.has(c.id));
    const species = pick(unseen.length > 0 && Math.random() < UNSEEN_BIAS ? unseen : candidates);

    rows.push({
      childId,
      date,
      slot,
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
      refreshRound,
    });
  }
  await prisma.dailyEncounter.createMany({ data: rows, skipDuplicates: true });
}

/**
 * 花阳光刷新今天的遇怪。
 *
 * **已经抓到的那些保留**（今天的战果不该被刷掉），只替换没抓到和跑掉的。
 * 两只都抓到了也允许刷——那时候它的意思是"再花钱多遇两只"，同样合理。
 *
 * 事务 + FOR UPDATE 锁 + 余额重查，写法同 throwBall / plantSeed：连点两次不会扣两次。
 * 次数和价格都在事务里按当天最大的 refreshRound 重算，不采信页面传来的东西。
 */
export async function refreshEncounters(childId: string, dateString: string) {
  // 日薪要查任务模板，放在事务外先算好——事务里只做扣费和改遇怪，别把锁的持有时间拉长。
  const costs = refreshCosts(await dailyEarnRate(childId));
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;
    const date = dateStringToUtcDate(dateString);

    const todays = await tx.dailyEncounter.findMany({ where: { childId, date } });
    const usedRounds = Math.max(0, ...todays.map((e) => e.refreshRound));
    if (usedRounds >= MAX_REFRESHES_PER_DAY) {
      throw new ActionError("今天的刷新次数用完啦，明天再来");
    }
    const cost = costs[usedRounds];

    const balance = await tx.pointsLedger.aggregate({ where: { childId }, _sum: { amount: true } });
    if ((balance._sum.amount ?? 0) < cost) throw new ActionError("阳光还不够哦");

    await tx.pointsLedger.create({
      data: {
        childId,
        amount: -cost,
        reason: `刷新今天遇到的宝可梦（第 ${usedRounds + 1} 次）`,
        type: LedgerType.POKEDEX_REFRESH,
      },
    });

    // 抓到的留着，其余的换掉
    const keep = todays.filter((e) => e.status === "CAUGHT");
    await tx.dailyEncounter.deleteMany({
      where: { childId, date, status: { not: "CAUGHT" } },
    });
    const nextSlot = Math.max(-1, ...todays.map((e) => e.slot)) + 1;

    return { round: usedRounds + 1, cost, keptCaught: keep.length, nextSlot };
  }).then(async (r) => {
    // 建新遇怪放在事务外：createEncounters 自己要查图鉴库和已拥有种类，
    // 塞进事务会把锁持有时间拉长，而这一步失败最多是"刷了没出新的"，刷新一下页面就补上了。
    await createEncounters(childId, dateString, DAILY_ENCOUNTER_COUNT, r.round, r.nextSlot);
    return r;
  });
}

/**
 * 朝**指定的那只**扔一个球。
 *
 * 事务内 + 对 Child 行加 FOR UPDATE 锁 + 重新聚合余额，写法和 lib/garden.ts 的
 * plantSeed 完全一致——孩子连点两次不能扣两次阳光。
 * 成功率、剩余次数、保底都在事务里重算，不采信页面传来的任何东西。
 */
export async function throwBall(
  encounterId: string,
  ballTypeId: string,
  childId: string
): Promise<ThrowResult> {
  // 各种奖励金额都按日薪算（见 lib/economy.ts）。算日薪要查任务模板，
  // 放事务外先算好，别让这次查询占着 Child 的行锁。
  const rate = await dailyEarnRate(childId);
  const milestoneBonus = pokedexMilestoneBonus(rate);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Child" WHERE id = ${childId} FOR UPDATE`;

    const child = await tx.child.findUnique({ where: { id: childId } });
    if (!child) throw new ActionError("找不到这个孩子");

    const ball = await tx.ballType.findUnique({ where: { id: ballTypeId } });
    if (!ball || ball.childId !== childId || !ball.active) {
      throw new ActionError("这种精灵球现在买不了");
    }

    // 目标必须是今天名单里、还没被抓到/跑掉、且还有机会的那只
    const encounter = await tx.dailyEncounter.findUnique({ where: { id: encounterId } });
    if (!encounter || encounter.childId !== childId) {
      throw new ActionError("找不到这只宝可梦");
    }
    if (formatStoredDate(encounter.date) !== todayDateString()) {
      throw new ActionError("这只是以前遇到的，今天遇不到啦");
    }
    if (encounter.status !== "AVAILABLE") {
      throw new ActionError(encounter.status === "CAUGHT" ? "已经抓到啦" : "它已经跑掉了");
    }
    if (encounter.attemptsUsed >= MAX_ATTEMPTS_PER_ENCOUNTER) {
      throw new ActionError("这只的机会用完了");
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

    // 目标就是名单上那只，属性在"遇到"时已经摇好了——孩子看到什么就会抓到什么
    const species = encounter;
    const attemptsLeft = MAX_ATTEMPTS_PER_ENCOUNTER - encounter.attemptsUsed - 1;

    const isMaster = ball.tier === BallTier.MASTER;
    const missStreak = child.catchMissStreak;
    const probability = isMaster ? 1 : catchProbability(species.rarity, ball.catchPower, missStreak);
    const byPity = !isMaster && missStreak >= PITY_GUARANTEE_AT;

    if (Math.random() >= probability) {
      const nextStreak = missStreak + 1;
      await tx.child.update({ where: { id: childId }, data: { catchMissStreak: nextStreak } });
      // 机会用完就真的跑了；还有机会的话留在名单上，孩子可以换更好的球再试
      await tx.dailyEncounter.update({
        where: { id: encounter.id },
        data: {
          attemptsUsed: encounter.attemptsUsed + 1,
          status: attemptsLeft <= 0 ? "FLED" : "AVAILABLE",
        },
      });

      const notes: Annotated[] = [];
      if (attemptsLeft > 0) {
        notes.push(annotate(`还剩 ${attemptsLeft} 次机会，可以换个好一点的球`));
      } else {
        notes.push(annotate("机会用完了，明天会遇到新的宝可梦"));
      }
      const guaranteedIn = Math.max(0, PITY_GUARANTEE_AT - nextStreak);
      if (species.rarity < 4) {
        notes.push(
          annotate(
            guaranteedIn > 0
              ? `下次运气 +${Math.round(nextStreak * PITY_BONUS_PER_MISS * 100)}%`
              : "下一次一定抓得到！"
          )
        );
      }
      return {
        outcome: "FLED",
        rarity: species.rarity,
        title: annotate(attemptsLeft > 0 ? `${species.nameZh} 挣脱了` : `${species.nameZh} 跑掉了`),
        notes,
      };
    }

    // 抓到了。是不是重复必须在插入之前判断——插完就分不清哪只是新的了。
    const alreadyOwned = await tx.caught.findFirst({
      where: { childId, speciesId: species.speciesId, status: CaughtStatus.OWNED },
      select: { id: true },
    });

    // 所有展示字段都快照下来，之后图鉴库更新也不影响这一只。
    await tx.caught.create({
      data: {
        childId,
        speciesId: species.speciesId,
        nameZh: species.nameZh,
        types: species.types,
        rarity: species.rarity,
        artUrl: species.artUrl,
        gender: species.gender,
        ability: species.ability,
        moveName: species.moveName,
        movePower: species.movePower,
        hp: species.hp,
        attack: species.attack,
        defense: species.defense,
        speed: species.speed,
        isShiny: species.isShiny,
        ballTypeId: ball.id,
        ballTier: ball.tier,
        caughtOnDate: todayAsUtcDate(),
      },
    });
    await tx.child.update({ where: { id: childId }, data: { catchMissStreak: 0 } });
    await tx.dailyEncounter.update({
      where: { id: encounter.id },
      data: { attemptsUsed: encounter.attemptsUsed + 1, status: "CAUGHT" },
    });

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
            amount: milestoneBonus,
            reason: `${marker}，收集奖励`,
            type: LedgerType.POKEDEX_BONUS,
          },
        });
        newMilestone = { total, bonus: milestoneBonus };
      }
    }

    // 重复的按稀有度返还一点阳光，让每一次成功都值点什么（见 economy.ts 的 duplicateRefund）
    let refund = 0;
    if (alreadyOwned) {
      refund = duplicateRefund(rate, species.rarity);
      if (refund > 0) {
        await tx.pointsLedger.create({
          data: {
            childId,
            amount: refund,
            reason: `重复的${species.nameZh}，换成阳光`,
            type: LedgerType.POKEDEX_DUPLICATE,
          },
        });
      }
    }

    // 同一种攒够了 → 这一种收集完成，发一次奖励。
    // 幂等靠 reason 里的标记：放生又抓回来凑到同一个数也不会重复发（同下面按种类数的里程碑）。
    const sameSpeciesCount = await tx.caught.count({
      where: { childId, speciesId: species.speciesId, status: CaughtStatus.OWNED },
    });
    const goal = masteryGoal(species.rarity);
    let mastery: { bonus: number } | null = null;
    if (sameSpeciesCount >= goal) {
      const marker = `${species.nameZh} 收集完成`;
      const already = await tx.pointsLedger.findFirst({
        where: { childId, type: LedgerType.POKEDEX_BONUS, reason: { startsWith: marker } },
      });
      if (!already) {
        const bonus = speciesMasteryBonus(rate, species.rarity);
        await tx.pointsLedger.create({
          data: {
            childId,
            amount: bonus,
            reason: `${marker}（${goal} 只），收集奖励`,
            type: LedgerType.POKEDEX_BONUS,
          },
        });
        mastery = { bonus };
      }
    }

    const notes: Annotated[] = [];
    if (mastery) {
      notes.push(annotate(`${species.nameZh} 集满 ${goal} 只，奖励 ${mastery.bonus} 阳光！`));
    }
    if (refund > 0) {
      notes.push(annotate(`已经有一只啦，这只换成 ${refund} 阳光`));
    }
    if (byPity) notes.push(annotate("坚持了这么多次，这只是你应得的"));
    if (newMilestone) {
      notes.push(
        annotate(`集齐 ${newMilestone.total} 种，奖励 ${newMilestone.bonus} 阳光`)
      );
    }

    return {
      outcome: "CAUGHT",
      rarity: species.rarity,
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
