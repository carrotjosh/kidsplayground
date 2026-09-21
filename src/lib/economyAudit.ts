import { BallTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  AMOUNT_MULTIPLIERS,
  economyRate,
  maxDailyPoints,
  observedEarnRate,
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
import {
  catchProbability,
  expectedCatchRate,
  POKEDEX_MILESTONE_STEP,
} from "@/lib/pokedex";

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

/** 这一项是哪张表里的哪一行，逐行改价时要用。dailyGoal 不是目录项，是 Child 上的一个字段。 */
export type PricedItemKind = "reward" | "ball" | "plant" | "dailyGoal";

export type PricedItem = {
  kind: PricedItemKind;
  id: string;
  label: string;
  cost: number;
  /** 折合几天工资 */
  days: number;
  band: { min: number; max: number } | null;
  status: "ok" | "low" | "high";
  /**
   * 越界时给一个建议价：贴到**最近的那条边界**，并朝区间内侧取整
   * （偏便宜就往上 ceil、偏贵就往下 floor）。
   *
   * 不用区间中点：很多项只是差一点点越界（比如 15 阳光算下来 0.395 天、下限 0.4），
   * 按中点会直接翻倍，那不是"修一下"是"改设计"。取边界改动最小；
   * 而朝内侧取整保证落进去之后不会因为四舍五入又滑出来、反复报警。
   */
  suggested: number | null;
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

function priced(
  kind: PricedItemKind,
  id: string,
  label: string,
  cost: number,
  rate: number,
  key: PriceBandKey | null
): PricedItem {
  const band = key ? { min: PRICE_BANDS[key].min, max: PRICE_BANDS[key].max } : null;
  const days = rate > 0 ? cost / rate : 0;
  const status = classify(days, band);
  return {
    kind,
    id,
    label,
    cost,
    days,
    band,
    status,
    suggested:
      status === "ok" || !band || rate <= 0
        ? null
        : Math.max(1, status === "low" ? Math.ceil(band.min * rate) : Math.floor(band.max * rate)),
  };
}

const BALL_BAND: Record<BallTier, PriceBandKey> = {
  [BallTier.POKE]: "ballPoke",
  [BallTier.GREAT]: "ballGreat",
  [BallTier.ULTRA]: "ballUltra",
  [BallTier.MASTER]: "ballMaster",
};

export async function auditEconomy(childId: string): Promise<EconomyAudit> {
  const [child, rewards, balls, plants, rate, maxPoints, observed] = await Promise.all([
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
    // 基准 = 达标线（家长的期待）。理论上限和实测收入只用来做对照和说实话，
    // 不参与定价——理由见 lib/economy.ts 的 economyRate。
    economyRate(childId),
    maxDailyPoints(childId),
    observedEarnRate(childId),
  ]);

  /**
   * 「要攒几天」一律按**实测收入**算，不按基准。
   *
   * 这里曾经拿理论上限（任务分值之和）除，于是后台告诉家长
   * "去迪士尼一次要攒 66 天"，而按孩子真实到手的速度是 231 天。
   * 那不是估算偏差，是直接错的——而家长正是照着这句话决定要不要降价。
   * 数据不足（建档不满一周）时退回基准，总比不显示强。
   */
  const payRate = observed && observed > 0 ? observed : rate;
  const daysToSave = (cost: number) => Math.round(cost / payRate);

  const findings: AuditFinding[] = [];

  // ---- 漂移 ----
  const baseline = child.priceBaselineRate;
  const drift = baseline > 0 ? rate / baseline : 1;
  if (rate === 0) {
    findings.push({
      level: "error",
      title: "每日达标线是 0",
      detail: "达标线是 0，所有价格都没有意义。先去「孩子档案」把每日达标线设成一个正数。",
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
      title: `基准从 ${baseline} 变成了 ${rate}`,
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
  // 里程碑也是扔球带来的收入，必须一起算进这条不变量。
  //
  // 漏过一次：原来只校验"重复返还 × 抓取率 vs 球价"，而**前期几乎没有重复**
  // （抓到的都是新种），真正把不变量踩穿的是里程碑。当时 pokedexMilestone 是
  // 4 天工资，模拟下来前 11 个里程碑扔球全程净赚——图鉴从消耗口变成了产出口，
  // 而体检一声不吭。
  //
  // 摊法：前期每只抓到的都算新种，所以 STEP / p̄ 就是凑够一个里程碑要扔的球数
  // （p̄ = 这种球的加权平均抓取率），里程碑摊到每个球上就是 M × p̄ / STEP。
  if (cheapest !== null && child.theme === "POKEDEX") {
    const milestone = pokedexMilestoneBonus(rate);
    for (const ball of balls) {
      const perBall = (milestone * expectedCatchRate(ball.catchPower)) / POKEDEX_MILESTONE_STEP;
      if (perBall > ball.cost * MAX_RETURN_RATIO) {
        const maxBonus = Math.floor(
          (ball.cost * MAX_RETURN_RATIO * POKEDEX_MILESTONE_STEP) / expectedCatchRate(ball.catchPower)
        );
        findings.push({
          level: "error",
          title: `图鉴里程碑太高，用${ball.title}刷就能赚阳光`,
          detail:
            `每 ${POKEDEX_MILESTONE_STEP} 种发 ${milestone} 阳光，而平均 ` +
            `${(POKEDEX_MILESTONE_STEP / expectedCatchRate(ball.catchPower)).toFixed(0)} 个${ball.title}` +
            `就能凑够——摊到每个球 ${perBall.toFixed(1)} 阳光，球本身才 ${ball.cost}。` +
            `孩子一直扔就能刷阳光，打卡就没意义了。里程碑降到 ${maxBonus} 以下，` +
            `或者把${ball.title}提价。`,
        });
        break;
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

  // ---- 不变量 3：达标线必须真的够得着 ----
  //
  // 基准现在**就是**达标线，所以原来那条"达标线不能高过日薪"成了恒真。
  // 真正要守的变成：达标线不能高过任务清单的理论上限——否则就算全做完也达不了标，
  // 日历永远不会点亮，满勤奖形同虚设。
  if (maxPoints > 0 && child.dailyGoalPoints > maxPoints) {
    findings.push({
      level: "error",
      title: `每日达标线 ${child.dailyGoalPoints} 高于任务总分 ${maxPoints}`,
      detail: "就算全部任务都做完也达不了标，日历永远不会点亮，满勤奖形同虚设。",
    });
  } else if (maxPoints > 0 && child.dailyGoalPoints / maxPoints > 0.9) {
    findings.push({
      level: "warn",
      title: `达标线是任务总分的 ${Math.round((child.dailyGoalPoints / maxPoints) * 100)}%`,
      detail:
        "几乎要全做完才算达标，偶尔漏一项就前功尽弃。" +
        "留点余量（六成左右）更容易形成习惯——达标该是「今天做到了」，不是「今天一点没落下」。",
    });
  }

  // ---- 不变量 4：贵的礼物必须有冷却 ----
  // 冷却才是真正锁住家长每月现金支出的旋钮（光靠涨价只会打击积极性）。
  // 便宜的日常小奖励不设冷却无所谓，但一个要攒好几天的东西没冷却，
  // 意味着孩子一旦攒够就能连着换，家长那个月的开销直接失控。
  const NO_COOLDOWN_MAX_DAYS = 3;
  for (const r of rewards) {
    if (r.cooldownDays === null && payRate > 0 && daysToSave(r.cost) > NO_COOLDOWN_MAX_DAYS) {
      findings.push({
        level: "warn",
        title: `「${r.title}」没有设置冷却`,
        detail: `它要攒 ${daysToSave(r.cost)} 天（按他实测每天 ${payRate.toFixed(1)} 阳光），但没有冷却限制——孩子攒够就能连着换。给它设一个冷却天数才锁得住每月开销。`,
      });
    }
  }

  // ---- 不变量 5：眼前必须有够得着的东西 ----
  //
  // 原来这条盯的是"最贵的礼物不能超过一个月工资"。那是错的方向：
  // 家长可能**故意**放一个要攒大半年的大目标（"去迪士尼一次"就是），
  // 那不是配置错误，是家长的选择。
  //
  // 真正会出问题的是反面——清单里最便宜的那个也要攒很久，孩子看哪儿都够不着。
  // 所以改成盯"最近的那个目标有多远"，并且按**实测收入**算，不按基准。
  const NEAREST_MAX_DAYS = 7;
  const cheapestReward = rewards.find((r) => r.cost > 0);
  if (payRate > 0 && cheapestReward && daysToSave(cheapestReward.cost) > NEAREST_MAX_DAYS) {
    findings.push({
      level: "warn",
      title: `最便宜的礼物「${cheapestReward.title}」也要攒 ${daysToSave(cheapestReward.cost)} 天`,
      detail:
        `按他实测每天 ${payRate.toFixed(1)} 阳光算，眼前没有一个够得着的目标，` +
        "攒的过程会显得遥遥无期。加一两个几天就能换到的小奖励，" +
        "大目标可以照旧放着——那个远是应该的。",
    });
  }

  const groups = [
    {
      title: "礼物商店",
      items: rewards.map((r) =>
        priced(
          "reward",
          r.id,
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
        .map((b) => priced("ball", b.id, b.title, b.cost, rate, BALL_BAND[b.tier])),
    },
    {
      title: "植物",
      items: plants.map((p) => priced("plant", p.id, p.title, p.cost, rate, "plant")),
    },
    {
      title: "其他",
      // 和**任务总分**比，不是和基准比——基准就是达标线本身，比出来恒等于 1
      items: [
        priced("dailyGoal", childId, "每日达标线（占任务总分）", child.dailyGoalPoints, maxPoints, "dailyGoal"),
      ],
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

  const [rewards, balls, plants] = await Promise.all([
    prisma.reward.findMany({ where: { childId }, orderBy: { cost: "asc" } }),
    prisma.ballType.findMany({ where: { childId } }),
    prisma.plantType.findMany({ where: { childId }, orderBy: { cost: "asc" } }),
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
    // **达标线不参与校准**。基准现在就是达标线（见 lib/economy.ts 的 economyRate），
    // 缩放它等于自己改自己：改完基准又变了，漂移永远归不了零，点一次校准就能
    // 把达标线一路推上去。它只能由家长在「孩子档案」里显式调整。
  ];

  return { factor, rows: rows.filter((r) => r.from !== r.to) };
}
