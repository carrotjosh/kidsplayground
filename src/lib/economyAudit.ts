import { BallTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  AMOUNT_MULTIPLIERS,
  dailyEarnRate,
  duplicateRefund,
  monthlyBonusPoints,
  PRICE_BANDS,
  pokedexMilestoneBonus,
  refreshCosts,
  rewardBand,
  speciesMasteryBonus,
  type PriceBandKey,
} from "@/lib/economy";
import { gardenSetSize, gardenSize } from "@/lib/garden";
import { catchProbability } from "@/lib/pokedex";

/**
 * 经济体检：把家长可改的那些价格换算成「几天工资」，和设计区间对一下，并校验几条硬不变量。
 *
 * 单独一个文件（而不是塞进 lib/economy.ts）是因为依赖方向：
 * 这里要读 pokedex 和 garden 的内部常量，而它俩都要 import economy.ts。
 * 合在一起就成环了。economy.ts 只往下依赖 db/date/tasks，谁都能安全 import。
 */

export type AuditLevel = "error" | "warn";

export type AuditFinding = {
  level: AuditLevel;
  title: string;
  detail: string;
};

export type PricedItem = {
  label: string;
  cost: number;
  /** 折合几天工资 */
  days: number;
  band: { min: number; max: number } | null;
  status: "ok" | "low" | "high";
};

export type EconomyAudit = {
  /** 当前日薪 */
  rate: number;
  /** 现有价格是按哪个日薪定的 */
  baseline: number;
  /** rate / baseline。1 表示没漂移 */
  drift: number;
  /** 系统按日薪自动发的那些数额，展示用 */
  derived: {
    monthlyBonus: number;
    refresh: number[];
    milestone: number;
    mastery: Record<number, number>;
    duplicate: Record<number, number>;
  };
  groups: { title: string; items: PricedItem[] }[];
  findings: AuditFinding[];
};

/** 漂移超过这个比例才提示校准。日薪 25→27 这种小变动不值得惊动家长。 */
const DRIFT_THRESHOLD = 0.12;

/**
 * 扔一次球的期望回报不能超过球价的这个比例。
 *
 * 为什么不是 1：等于 1 意味着扔球盈亏平衡，孩子只要一直扔就能白嫖——
 * 抓宝可梦必须是**花掉**阳光的地方，不能是赚阳光的地方，否则任务打卡就失去意义了。
 * 留一半的余量是为了保底加成（连续失败会把成功率一路推高）也不至于把这条踩穿。
 */
const MAX_RETURN_RATIO = 0.5;

function classify(days: number, band: { min: number; max: number } | null): PricedItem["status"] {
  if (!band) return "ok";
  if (days < band.min) return "low";
  if (days > band.max) return "high";
  return "ok";
}

function priced(label: string, cost: number, rate: number, key: PriceBandKey | null): PricedItem {
  const band = key ? { min: PRICE_BANDS[key].min, max: PRICE_BANDS[key].max } : null;
  const days = rate > 0 ? cost / rate : 0;
  return { label, cost, days, band, status: classify(days, band) };
}

const BALL_BAND: Record<BallTier, PriceBandKey> = {
  [BallTier.POKE]: "ballPoke",
  [BallTier.GREAT]: "ballGreat",
  [BallTier.ULTRA]: "ballUltra",
  [BallTier.MASTER]: "ballMaster",
};

export async function auditEconomy(childId: string): Promise<EconomyAudit> {
  const [child, rewards, balls, plants, rate] = await Promise.all([
    prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: {
        dailyGoalPoints: true,
        priceBaselineRate: true,
        theme: true,
        gardenStage: true,
      },
    }),
    prisma.reward.findMany({ where: { childId, active: true }, orderBy: { cost: "asc" } }),
    prisma.ballType.findMany({ where: { childId, active: true } }),
    prisma.plantType.findMany({ where: { childId, active: true }, orderBy: { cost: "asc" } }),
    dailyEarnRate(childId),
  ]);

  const findings: AuditFinding[] = [];

  // ---- 漂移 ----
  const baseline = child.priceBaselineRate;
  const drift = baseline > 0 ? rate / baseline : 1;
  if (rate === 0) {
    findings.push({
      level: "error",
      title: "没有任何生效中的任务",
      detail: "日薪是 0，孩子赚不到阳光，所有价格都没有意义。先去「任务模板」加几项。",
    });
  } else if (Math.abs(drift - 1) >= DRIFT_THRESHOLD) {
    // 刻意不说"价格失准了，快校准"。
    //
    // 日薪变了**不一定**意味着价格错了。阳光本来就和任务难度挂钩，所以
    // 「200 阳光」永远代表同样多的工作量——加了一门课只是让孩子赚得更快，
    // 每份奖励背后的付出没变。要不要跟着改价，取决于家长想保持哪个量不变，
    // 这是个价值判断，不该由这个页面替他做。
    const pct = Math.round(Math.abs(drift - 1) * 100);
    const days = drift > 1 ? "更快" : "更慢";
    findings.push({
      level: "warn",
      title: `日薪从 ${baseline} 变成了 ${rate}`,
      detail:
        `孩子每天${drift > 1 ? "多" : "少"}赚 ${pct}%，同一份奖励现在攒得${days}了。改不改价看你想保持哪个不变：` +
        `想让「同样的付出换同样的东西」就不用改——阳光和任务难度挂钩，付出本来就没变，只是赚得${days}；` +
        `想让「同样的时间换同样的东西」就按 ${drift.toFixed(2)}× 校准。`,
    });
  }

  // ---- 不变量 1：扔球不能变成赚钱手段 ----
  // 球价是家长可改的，改低了就可能出现"扔球期望回报 > 球价"，那样整个经济会被刷穿。
  const cheapest = balls.reduce<number | null>(
    (min, b) => (min === null || b.cost < min ? b.cost : min),
    null
  );
  for (const ball of balls) {
    for (const rarity of [1, 2, 3, 4]) {
      const expected = catchProbability(rarity, ball.catchPower, 0) * duplicateRefund(rate, rarity);
      if (expected > ball.cost * MAX_RETURN_RATIO) {
        findings.push({
          level: "error",
          title: `${ball.title} 打「${["", "普通", "少见", "稀有", "传说"][rarity]}」能赚阳光`,
          detail: `期望回报 ${expected.toFixed(1)} 阳光，而球只要 ${ball.cost}。孩子一直扔就能刷阳光，打卡就没意义了。把这种球的价格提到 ${Math.ceil(expected / MAX_RETURN_RATIO)} 以上。`,
        });
        break; // 同一种球只报一次，不用四档都刷屏
      }
    }
  }
  if (cheapest === null && child.theme === "POKEDEX") {
    findings.push({
      level: "error",
      title: "一种精灵球都没有上架",
      detail: "孩子进图鉴页会什么都买不了。去「精灵球」页至少上架一种。",
    });
  }

  // ---- 不变量 2：花园必须能集齐 ----
  // 需要几种植物随花园级数变（4×4 要 4 种、5×5 要 5 种……），所以按孩子当前的级数算。
  const setSize = gardenSetSize(child.gardenStage);
  const size = gardenSize(child.gardenStage);
  if (child.theme === "GARDEN" && plants.length * setSize !== size) {
    findings.push({
      level: "error",
      title: `上架了 ${plants.length} 种植物，花园永远集不齐`,
      detail: `现在是第 ${child.gardenStage} 级花园（${size} 格、每种要种满 ${setSize} 棵），所以上架的必须正好 ${size / setSize} 种。现在孩子怎么种都拿不到收获奖励。`,
    });
  }

  // ---- 不变量 3：达标线不能高过日薪 ----
  if (rate > 0 && child.dailyGoalPoints > rate) {
    findings.push({
      level: "error",
      title: `每日达标线 ${child.dailyGoalPoints} 高于日薪 ${rate}`,
      detail: "就算全部任务都做完也达不了标，日历永远不会点亮，满勤奖形同虚设。",
    });
  }

  // ---- 不变量 4：贵的礼物必须有冷却 ----
  // 冷却才是真正锁住家长每月现金支出的旋钮（光靠涨价只会打击积极性）。
  // 便宜的日常小奖励不设冷却无所谓，但一个要攒好几天的东西没冷却，
  // 意味着孩子一旦攒够就能连着换，家长那个月的开销直接失控。
  const NO_COOLDOWN_MAX_DAYS = 3;
  for (const r of rewards) {
    if (r.cooldownDays === null && rate > 0 && r.cost / rate > NO_COOLDOWN_MAX_DAYS) {
      findings.push({
        level: "warn",
        title: `「${r.title}」没有设置冷却`,
        detail: `它要攒 ${Math.round(r.cost / rate)} 天，但没有冷却限制——孩子攒够就能连着换。给它设一个冷却天数才锁得住每月开销。`,
      });
    }
  }

  // ---- 不变量 5：最贵的礼物不能遥不可及 ----
  const priciest = rewards[rewards.length - 1];
  if (rate > 0 && priciest && priciest.cost / rate > 30) {
    findings.push({
      level: "warn",
      title: `「${priciest.title}」要攒 ${Math.round(priciest.cost / rate)} 天`,
      detail: "超过一个月工资的目标，一年级孩子很难维持动力。考虑降价或者拆成阶段性小目标。",
    });
  }

  const groups = [
    {
      title: "礼物商店",
      items: rewards.map((r) =>
        priced(
          `${r.title}（${r.cooldownDays ? `${r.cooldownDays} 天冷却` : "不限次数"}）`,
          r.cost,
          rate,
          rewardBand(r.cooldownDays)
        )
      ),
    },
    {
      title: "精灵球",
      items: [...balls]
        .sort((a, b) => a.cost - b.cost)
        .map((b) => priced(b.title, b.cost, rate, BALL_BAND[b.tier])),
    },
    {
      title: "植物",
      items: plants.map((p) => priced(p.title, p.cost, rate, "plant")),
    },
    {
      title: "其他",
      items: [priced("每日达标线", child.dailyGoalPoints, rate, "dailyGoal")],
    },
  ].filter((g) => g.items.length > 0);

  return {
    rate,
    baseline,
    drift,
    derived: {
      monthlyBonus: monthlyBonusPoints(rate),
      refresh: refreshCosts(rate),
      milestone: pokedexMilestoneBonus(rate),
      mastery: Object.fromEntries(
        Object.keys(AMOUNT_MULTIPLIERS.speciesMastery).map((r) => [
          Number(r),
          speciesMasteryBonus(rate, Number(r)),
        ])
      ),
      duplicate: Object.fromEntries(
        Object.keys(AMOUNT_MULTIPLIERS.duplicateRefund).map((r) => [
          Number(r),
          duplicateRefund(rate, Number(r)),
        ])
      ),
    },
    groups,
    findings,
  };
}

export type RecalibrationRow = { kind: string; label: string; from: number; to: number };

/** 按 drift 逐项算出校准后的价格。**只算不写**，页面拿它做预览。 */
export async function recalibrationPreview(childId: string): Promise<{
  factor: number;
  rows: RecalibrationRow[];
}> {
  const { rate, baseline } = await auditEconomy(childId);
  const factor = baseline > 0 && rate > 0 ? rate / baseline : 1;

  const [rewards, balls, plants, child] = await Promise.all([
    prisma.reward.findMany({ where: { childId }, orderBy: { cost: "asc" } }),
    prisma.ballType.findMany({ where: { childId } }),
    prisma.plantType.findMany({ where: { childId }, orderBy: { cost: "asc" } }),
    prisma.child.findUniqueOrThrow({ where: { id: childId }, select: { dailyGoalPoints: true } }),
  ]);

  // 零成本礼物（"今晚吃什么我决定"那类）本来就该保持零成本，乘以任何倍数都还是 0，
  // 但显式跳过更清楚：它们不是"便宜的礼物"，是刻意不花钱的那一档。
  const scale = (n: number) => Math.max(1, Math.round(n * factor));

  const rows: RecalibrationRow[] = [
    ...rewards
      .filter((r) => r.cost > 0)
      .map((r) => ({ kind: "reward", label: r.title, from: r.cost, to: scale(r.cost) })),
    ...[...balls]
      .sort((a, b) => a.cost - b.cost)
      .map((b) => ({ kind: "ball", label: b.title, from: b.cost, to: scale(b.cost) })),
    ...plants.map((p) => ({ kind: "plant", label: p.title, from: p.cost, to: scale(p.cost) })),
    {
      kind: "dailyGoal",
      label: "每日达标线",
      from: child.dailyGoalPoints,
      to: scale(child.dailyGoalPoints),
    },
  ];

  return { factor, rows: rows.filter((r) => r.from !== r.to) };
}
