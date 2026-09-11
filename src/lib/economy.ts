import { prisma } from "@/lib/db";
import { addDays, todayDateString } from "@/lib/date";
import { isTemplateDueOn } from "@/lib/tasks";

/**
 * 经济系统的度量衡。
 *
 * 这个文件解决一件事：**整套定价原来是对着"每天 25 阳光"这一个假设硬编码的**，
 * 而家长随时会加一门课、删一项任务，日薪一变，所有价格就静默失准——
 * 玩具从"攒 20 天"变成"攒 13 天"，而系统里没有任何地方会提这一句。
 *
 * 处理办法是把数字分成两类：
 *
 * 1. **系统自动发的数额**（满勤奖、刷新费、里程碑、重复返还……）
 *    → 改成日薪 D 的倍数，永远自动跟上，不需要任何人维护。
 *    这些本来就不是"价格"，是奖励力度，跟着收入走才是对的。
 *
 * 2. **家长自己定的价格**（礼物 / 精灵球 / 植物目录）
 *    → 仍然存绝对数字，孩子看到的价格保持稳定。
 *    系统只负责体检：算出漂移了多少、哪几项越界，给一个带预览的一键校准，改不改由家长决定。
 *
 * 依赖方向很重要：这个文件**只能**往下依赖 db / date / tasks。
 * pokedex.ts 和 calendar.ts 要 import 它，反过来 import 会成环。
 * 需要 pokedex/garden 内部常量的那部分体检逻辑放在 lib/economyAudit.ts。
 */

/**
 * 算日薪的窗口。取 28 天而不是 30：正好 4 整周，
 * 按星期几排的模板每个星期几不多不少各命中 4 次，不会因为窗口起点是周几而抖动。
 */
const RATE_WINDOW_DAYS = 28;

/** 日薪的下限。一个任务都没排时 D=0，会让刷新费变成 0（白嫖）、满勤奖变成 0，所以兜一个底。 */
const MIN_RATE = 1;

type SchedulableTemplate = Parameters<typeof isTemplateDueOn>[0] & { points: number };

/**
 * 日薪 D：往后 28 天平均每天能挣多少阳光。
 *
 * 用真实日历逐天算而不是按"每周几天 ÷ 7"估：WORKDAY / HOLIDAY 两种排期要看法定节假日和调休，
 * 拍 5/7、2/7 在国庆和春节那两个月能差出百分之几十。isTemplateDueOn 是排任务时用的同一个函数，
 * 用它就保证了"体检算出来的日薪"和"孩子实际拿到的阳光"是同一套规则。
 */
export function dailyEarnRateFromTemplates(
  templates: SchedulableTemplate[],
  from: string = todayDateString()
): number {
  if (templates.length === 0) return 0;

  let total = 0;
  let date = from;
  for (let i = 0; i < RATE_WINDOW_DAYS; i++) {
    for (const template of templates) {
      if (isTemplateDueOn(template, date)) total += template.points;
    }
    date = addDays(date, 1);
  }
  return Math.round(total / RATE_WINDOW_DAYS);
}

/** 读库版本。只算 active 的模板——停用的模板不产生阳光，不该算进日薪。 */
export async function dailyEarnRate(childId: string): Promise<number> {
  const templates = await prisma.taskTemplate.findMany({
    where: { childId, active: true },
    select: { points: true, scheduleType: true, weekdays: true },
  });
  return dailyEarnRateFromTemplates(templates);
}

/**
 * 系统自动发的各种数额，单位是「天工资」。
 *
 * 这些倍数是从原来那套硬编码常量除以 25 反推出来的，所以在日薪 25 时数值分毫不变
 * （满勤奖 150、刷新 5/12/25、里程碑 100、收集完成 40/80/150/500、重复返还 3/8/20/60）。
 * 换句话说这次改造对现有存档是零影响的，只是把常数换成了函数。
 */
export const AMOUNT_MULTIPLIERS = {
  /** 月度满勤奖 ≈ 6 天工资。够分量，又不至于让平时的努力显得不重要。 */
  monthlyBonus: 6,
  /** 有偿刷新，递增。第一次比一个精灵球还便宜，第三次是一整天的收入。 */
  refresh: [0.2, 0.5, 1.0],
  /** 每集齐 8 种不同宝可梦的里程碑奖励。 */
  pokedexMilestone: 4,
  /** 同一种攒够目标数量的"收集完成"奖励，按稀有度递增。 */
  speciesMastery: { 1: 1.6, 2: 3.2, 3: 6, 4: 20 } as Record<number, number>,
  /**
   * 抓到重复的返还。
   * 这一组必须保持**远小于**最便宜的球价，否则扔球会变成赚钱手段、整个经济崩盘。
   * 球价是家长可改的，所以这条不能只靠这里的数值保证——lib/economyAudit.ts 里有实时校验。
   */
  duplicateRefund: { 1: 0.12, 2: 0.32, 3: 0.8, 4: 2.4 } as Record<number, number>,
} as const;

/** 把「天工资」换算成阳光。至少 1，避免出现 0 阳光的奖励或 0 阳光的刷新。 */
function amount(rate: number, days: number): number {
  return Math.max(1, Math.round(Math.max(rate, MIN_RATE) * days));
}

export function monthlyBonusPoints(rate: number): number {
  return amount(rate, AMOUNT_MULTIPLIERS.monthlyBonus);
}

export function refreshCosts(rate: number): number[] {
  return AMOUNT_MULTIPLIERS.refresh.map((m) => amount(rate, m));
}

export function pokedexMilestoneBonus(rate: number): number {
  return amount(rate, AMOUNT_MULTIPLIERS.pokedexMilestone);
}

export function speciesMasteryBonus(rate: number, rarity: number): number {
  return amount(rate, AMOUNT_MULTIPLIERS.speciesMastery[rarity] ?? AMOUNT_MULTIPLIERS.speciesMastery[1]);
}

export function duplicateRefund(rate: number, rarity: number): number {
  return amount(rate, AMOUNT_MULTIPLIERS.duplicateRefund[rarity] ?? AMOUNT_MULTIPLIERS.duplicateRefund[1]);
}

/**
 * 家长可改价的那些目录，各自的设计区间，单位同样是「天工资」。
 *
 * 区间是从日薪 25 时的默认目录反推的（见 lib/bootstrap.ts），并向两侧留了余量——
 * 目的是抓出"手滑把玩具标成 50"这种错误，不是逼家长照抄默认值。
 *
 * 礼物按**冷却天数**分档，因为冷却才是真正决定家长每月现金支出上限的旋钮：
 * 一个 600 阳光但每天能换的礼物，比一个 600 阳光每月只能换一次的危险得多。
 */
export const PRICE_BANDS = {
  rewardDaily: { label: "日常礼物（冷却 ≤1 天）", min: 0.4, max: 1.2 },
  rewardWeekly: { label: "周礼物（冷却 2~7 天）", min: 1.2, max: 7 },
  rewardBiweekly: { label: "半月礼物（冷却 8~14 天）", min: 3, max: 8 },
  rewardMonthly: { label: "大礼物（冷却 ≥15 天）", min: 14, max: 28 },
  ballPoke: { label: "精灵球", min: 0.25, max: 0.4 },
  ballGreat: { label: "超级球", min: 0.6, max: 1.0 },
  ballUltra: { label: "高级球", min: 1.5, max: 2.2 },
  ballMaster: { label: "大师球", min: 6, max: 10 },
  // 上限放到 2.5 天：花园升级会解锁更贵的品种（寒冰射手 40、大嘴花 55），
  // 按第 1 级那四种（8~30）卡上限的话，一升级就会开始误报"偏贵"。
  plant: { label: "植物", min: 0.25, max: 2.5 },
  dailyGoal: { label: "每日达标线", min: 0.6, max: 0.9 },
} as const;

export type PriceBandKey = keyof typeof PRICE_BANDS;

/**
 * 礼物按冷却天数落到哪一档。
 *
 * 不限次数（null）**不给档位**：档位是从冷却推出来的，没有冷却就推不出这是"日常小奖励"
 * 还是"家长忘了设冷却的大奖"。硬当成日常的话，一个 2500 阳光的迪士尼会被报成"偏贵"，
 * 而真正该说的是"你没给它设冷却"——那条由 economyAudit.ts 单独报。
 */
export function rewardBand(cooldownDays: number | null): PriceBandKey | null {
  if (cooldownDays === null) return null;
  if (cooldownDays <= 1) return "rewardDaily";
  if (cooldownDays <= 7) return "rewardWeekly";
  if (cooldownDays <= 14) return "rewardBiweekly";
  return "rewardMonthly";
}
