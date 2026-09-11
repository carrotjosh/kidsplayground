/**
 * 经济系统自检。
 *
 * 用法：npm run check:economy
 *
 * 建一个临时租户，逐条验证：日薪算得对、按日薪派生的奖励金额没变、
 * 四条硬不变量都能报出来、一键校准是幂等的、图鉴分地区解锁能触发且不重复。
 * 跑完把临时租户连同数据一起删掉（放在 finally 里，中途炸了也不留垃圾）。
 *
 * 为什么值得常驻一个脚本：这些数字全是模拟出来的平衡值，以后任何人调一个常量都可能
 * 悄悄踩穿"扔球不能赚钱""花园必须能集齐"这类前提，而那些错误在界面上完全看不出来。
 */
import "dotenv/config";

import { hashPassword } from "../src/lib/auth";
import { seedDefaultsForChild } from "../src/lib/bootstrap";
import { CaughtStatus, Gender, ScheduleType } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import { purgeTestTenants } from "../src/lib/testTenant";
import { addDays, dateStringToUtcDate, todayAsUtcDate, todayDateString } from "../src/lib/date";
import {
  dailyEarnRate,
  dailyEarnRateFromTemplates,
  duplicateRefund,
  monthlyBonusPoints,
  pokedexMilestoneBonus,
  refreshCosts,
  speciesMasteryBonus,
} from "../src/lib/economy";
import { auditEconomy, recalibrationPreview } from "../src/lib/economyAudit";
import {
  checkLevelUp,
  LEVELS,
  levelForEarned,
  getLevelRoadmap,
  levelProgress,
  MAX_LEVEL,
  totalEarned,
} from "../src/lib/level";
import {
  checkGardenStageUp,
  computeHarvestBonus,
  gardenSetSize,
  gardenSide,
  gardenSize,
  GARDEN_STAGES,
  HARVEST_MAX_INTEREST_DAYS,
  HARVEST_MAX_MULTIPLIER,
  HARVEST_ROUNDS_PER_STAGE,
  settleGardenForChild,
} from "../src/lib/garden";
import {
  checkRegionUnlock,
  ensureTodayEncounters,
  REGION_UNLOCK_RATIO,
  REGIONS,
  regionCeiling,
} from "../src/lib/pokedex";

const MARK = "__econ_check__";
let failures = 0;

function pass(what: string) {
  console.log(`  ✅ ${what}`);
}
function fail(what: string, detail: string) {
  failures += 1;
  console.log(`  ❌ ${what} —— ${detail}`);
}
function expect(what: string, actual: unknown, want: unknown) {
  const a = JSON.stringify(actual);
  const w = JSON.stringify(want);
  if (a === w) pass(`${what} = ${a}`);
  else fail(what, `期望 ${w}，实际 ${a}`);
}
/** 断言体检结果里有一条标题包含 needle 的问题。 */
function expectFinding(findings: { title: string }[], needle: string, what: string) {
  if (findings.some((f) => f.title.includes(needle))) pass(what);
  else fail(what, `没有报出来，实际报了：${findings.map((f) => f.title).join(" / ") || "（无）"}`);
}

async function createTenant() {
  const user = await prisma.user.create({
    data: {
      email: `${MARK}-${Date.now()}@example.invalid`,
      passwordHash: await hashPassword("test-password-123"),
    },
  });
  const child = await prisma.child.create({
    data: { name: `${MARK}`, slug: `econ-${Date.now()}`, userId: user.id, theme: "POKEDEX" },
  });
  await seedDefaultsForChild(child.id);
  return { user, child };
}

async function destroyTenant(childId: string, userId: string) {
  await prisma.$transaction([
    prisma.pointsLedger.deleteMany({ where: { childId } }),
    prisma.caught.deleteMany({ where: { childId } }),
    prisma.dailyEncounter.deleteMany({ where: { childId } }),
    prisma.ballType.deleteMany({ where: { childId } }),
    prisma.redemption.deleteMany({ where: { childId } }),
    prisma.plant.deleteMany({ where: { childId } }),
    prisma.dailyTask.deleteMany({ where: { childId } }),
    prisma.reward.deleteMany({ where: { childId } }),
    prisma.plantType.deleteMany({ where: { childId } }),
    prisma.taskTemplate.deleteMany({ where: { childId } }),
    prisma.child.delete({ where: { id: childId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

async function main() {
  // 上一次跑到一半崩了的话，临时租户会留在库里（真发生过：清理那步 Neon 连接抖了一下）。
  // finally 里的清理自己也可能失败，所以开跑前先扫一遍残骸。
  const swept = await purgeTestTenants(MARK);
  if (swept > 0) console.log(`清理了 ${swept} 个上次残留的临时租户。`);

  // ---------- 1. 日薪 ----------
  console.log("\n【日薪】按真实日历逐天算，不是按 5/7、2/7 拍");
  const daily = (points: number, weekdays: number[]) => ({
    points,
    scheduleType: ScheduleType.WEEKDAYS,
    weekdays,
  });
  expect(
    "默认三项任务(10+10+5，每天)",
    dailyEarnRateFromTemplates([
      daily(10, [0, 1, 2, 3, 4, 5, 6]),
      daily(10, [0, 1, 2, 3, 4, 5, 6]),
      daily(5, [0, 1, 2, 3, 4, 5, 6]),
    ]),
    25
  );
  expect("只排周一到周五、每次 7 分", dailyEarnRateFromTemplates([daily(7, [1, 2, 3, 4, 5])]), 5);
  expect("只排周末、每次 14 分", dailyEarnRateFromTemplates([daily(14, [0, 6])]), 4);
  expect("没有任何模板", dailyEarnRateFromTemplates([]), 0);

  // ---------- 2. 按日薪派生的金额 ----------
  // 这一组是回归测试：改造前它们是硬编码常量，改造后必须一模一样，
  // 否则等于在孩子毫不知情的情况下改了他的奖励。
  console.log("\n【派生金额】日薪 25 时必须和改造前的硬编码完全一致");
  expect("月度满勤奖", monthlyBonusPoints(25), 150);
  expect("图鉴里程碑", pokedexMilestoneBonus(25), 100);
  expect(
    "单种收集完成",
    [1, 2, 3, 4].map((r) => speciesMasteryBonus(25, r)),
    [40, 80, 150, 500]
  );
  expect(
    "重复返还",
    [1, 2, 3, 4].map((r) => duplicateRefund(25, r)),
    [3, 8, 20, 60]
  );
  // 刷新中间那档原来是 12，现在 0.5×25=12.5 四舍五入成 13。差 1 阳光，可以接受。
  expect("刷新费（第二档由 12 变 13，四舍五入）", refreshCosts(25), [5, 13, 25]);

  console.log("\n【派生金额】日薪变了要自动跟上");
  expect("日薪 38 的满勤奖", monthlyBonusPoints(38), 228);
  expect("日薪 38 的刷新费", refreshCosts(38), [8, 19, 38]);
  // 一个任务都没有时 D=0，刷新费不能变成 0——那样孩子可以无限白嫖刷新
  if (refreshCosts(0).every((c) => c >= 1)) pass("日薪 0 时刷新费仍 ≥1，不会白嫖");
  else fail("日薪 0 时的刷新费", `是 ${refreshCosts(0)}`);

  // ---------- 花园：收获利息 ----------
  // 这一组守的是一个真实存在过的严重漏洞：收获原来是"成本 × 1.5"、且收获会清空全部格子，
  // 而种植和收获都没有天数限制——余额够种满一园之后，"种满→收获→再种满→再收获"
  // 可以在同一次操作里无限循环，每圈净赚 50%，整个阳光经济直接作废。
  console.log("\n【花园】收获按天计息，当天种当天收没有利息");
  const today = todayDateString();
  const plantsAt = (costs: number[], daysAgo: number) =>
    costs.map((cost) => ({
      ledgerEntry: { amount: -cost },
      plantedOnDate: dateStringToUtcDate(addDays(today, -daysAgo)),
    }));
  const fullSet = [8, 8, 8, 8, 12, 12, 12, 12, 18, 18, 18, 18, 30, 30, 30, 30];

  const instant = computeHarvestBonus(plantsAt(fullSet, 0), today);
  expect("种满一园的本金", instant.spent, 272);
  expect("当天种当天收的收获（必须等于本金，否则能刷循环）", instant.bonus, 272);

  const ripe = computeHarvestBonus(plantsAt(fullSet, HARVEST_MAX_INTEREST_DAYS), today);
  expect(`养满 ${HARVEST_MAX_INTEREST_DAYS} 天的收获`, ripe.bonus, Math.ceil(272 * HARVEST_MAX_MULTIPLIER));

  const overripe = computeHarvestBonus(plantsAt(fullSet, 90), today);
  expect("养 90 天也不会超过上限（利息封顶）", overripe.bonus, ripe.bonus);

  // 逐棵取整的话 16 棵能白捡十几点，所以只在总额上取整一次
  const halfway = computeHarvestBonus(plantsAt(fullSet, 3), today);
  expect("养 3 天", halfway.bonus, Math.ceil(272 * 1.15));

  const { user, child } = await createTenant();
  try {
    // ---------- 3. 干净状态 ----------
    console.log("\n【体检】默认配置应该是干净的");
    expect("默认日薪", await dailyEarnRate(child.id), 25);
    const clean = await auditEconomy(child.id);
    if (clean.findings.length === 0) pass("默认配置没有任何问题");
    else fail("默认配置", `报了 ${clean.findings.map((f) => f.title).join(" / ")}`);

    // ---------- 4. 四条不变量 ----------
    console.log("\n【不变量】把配置改坏，每一条都要能报出来");

    // (1) 球价改到 1 → 扔球期望回报超过球价，能刷阳光
    const poke = await prisma.ballType.findFirstOrThrow({
      where: { childId: child.id, tier: "POKE" },
    });
    await prisma.ballType.update({ where: { id: poke.id }, data: { cost: 1 } });
    expectFinding((await auditEconomy(child.id)).findings, "能赚阳光", "球价 1 → 报出「扔球能赚阳光」");
    await prisma.ballType.update({ where: { id: poke.id }, data: { cost: poke.cost } });

    // (2) 植物删到 3 种 → 4×4 的花园永远集不齐
    await prisma.child.update({ where: { id: child.id }, data: { theme: "GARDEN" } });
    const extra = await prisma.plantType.findFirstOrThrow({ where: { childId: child.id } });
    await prisma.plantType.update({ where: { id: extra.id }, data: { active: false } });
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "永远集不齐",
      "植物只剩 3 种 → 报出「花园集不齐」"
    );
    await prisma.plantType.update({ where: { id: extra.id }, data: { active: true } });
    await prisma.child.update({ where: { id: child.id }, data: { theme: "POKEDEX" } });

    // (3) 达标线高过日薪 → 永远达不了标
    await prisma.child.update({ where: { id: child.id }, data: { dailyGoalPoints: 99 } });
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "高于日薪",
      "达标线 99 > 日薪 25 → 报出「永远达不了标」"
    );
    await prisma.child.update({ where: { id: child.id }, data: { dailyGoalPoints: 20 } });

    // (4) 最贵的礼物超过一个月工资
    const big = await prisma.reward.findFirstOrThrow({
      where: { childId: child.id },
      orderBy: { cost: "desc" },
    });
    await prisma.reward.update({ where: { id: big.id }, data: { cost: 2000 } });
    expectFinding((await auditEconomy(child.id)).findings, "要攒", "礼物 2000 → 报出「攒太久」");
    await prisma.reward.update({ where: { id: big.id }, data: { cost: big.cost } });

    // ---------- 5. 漂移与校准 ----------
    console.log("\n【校准】加一门任务后价格应该被判定为偏便宜，校准一次即归位");
    await prisma.taskTemplate.create({
      data: {
        childId: child.id,
        title: "练琴30分钟",
        subject: "练琴",
        amount: 30,
        unit: "分钟",
        points: 13,
        scheduleType: ScheduleType.WEEKDAYS,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    expect("加一门 13 分的任务后日薪", await dailyEarnRate(child.id), 38);
    const drifted = await auditEconomy(child.id);
    expectFinding(drifted.findings, "日薪从 25 变成了 38", "报出日薪漂移");

    const preview = await recalibrationPreview(child.id);
    expect("校准倍数", Number(preview.factor.toFixed(2)), 1.52);
    const toyBefore = await prisma.reward.findFirstOrThrow({
      where: { childId: child.id, title: "一个小玩具" },
    });
    const toyRow = preview.rows.find((r) => r.label === "一个小玩具");
    expect("预览里「一个小玩具」500 →", toyRow?.to, 760);
    // 零成本礼物不该出现在预览里：它们是刻意不花阳光的一档，不是"很便宜"
    if (!preview.rows.some((r) => r.from === 0)) pass("零成本礼物不参与校准");
    else fail("零成本礼物", "被算进了校准");

    // 直接调 lib 层做校准（action 需要会话上下文，脚本里造不出来）。
    // 这段必须和 economy/actions.ts 的 recalibrateAction 保持一致，
    // 尤其是**基准值写的是 `原基准 × 倍数` 而不是当前日薪**——部分校准全靠这一点才诚实。
    async function calibrate(factor: number) {
      const scale = (n: number) => Math.max(1, Math.round(n * factor));
      const c = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
      const [rewards, balls, plants] = await Promise.all([
        prisma.reward.findMany({ where: { childId: child.id, cost: { gt: 0 } } }),
        prisma.ballType.findMany({ where: { childId: child.id } }),
        prisma.plantType.findMany({ where: { childId: child.id } }),
      ]);
      await prisma.$transaction([
        ...rewards.map((r) =>
          prisma.reward.update({ where: { id: r.id }, data: { cost: scale(r.cost) } })
        ),
        ...balls.map((b) =>
          prisma.ballType.update({ where: { id: b.id }, data: { cost: scale(b.cost) } })
        ),
        ...plants.map((p) =>
          prisma.plantType.update({ where: { id: p.id }, data: { cost: scale(p.cost) } })
        ),
        prisma.child.update({
          where: { id: child.id },
          data: {
            dailyGoalPoints: scale(c.dailyGoalPoints),
            priceBaselineRate: scale(c.priceBaselineRate),
          },
        }),
      ]);
    }

    // ---- 部分校准：只涨 15%，基准值必须跟着只走 15% ----
    // 这是最容易写错的一处：图省事把基准直接设成当前日薪的话，页面下次就会显示
    // "没有漂移"，而实际上价格还便宜着 31%——等于系统对家长撒了谎。
    console.log("\n【部分校准】只调一部分时，基准值只能走一部分");
    await calibrate(1.15);
    expect(
      "只涨 15% 后「一个小玩具」500 →",
      (await prisma.reward.findUniqueOrThrow({ where: { id: toyBefore.id } })).cost,
      575
    );
    const partial = await auditEconomy(child.id);
    expect("基准值 25 → (不是 38)", partial.baseline, 29);
    expect("剩余漂移", Number(partial.drift.toFixed(2)), 1.31);
    expectFinding(partial.findings, "日薪从 29 变成了 38", "仍然如实提示还剩多少没调");

    // ---- 再调到位 ----
    const rate = await dailyEarnRate(child.id);
    await calibrate(rate / partial.baseline);
    const toyAfter = await prisma.reward.findUniqueOrThrow({ where: { id: toyBefore.id } });
    // 分两步走会因为中间四舍五入和一步到位差几个阳光（760 vs 754），这是可以接受的
    if (Math.abs(toyAfter.cost - 760) <= 10) pass(`分两步调完「一个小玩具」= ${toyAfter.cost}（一步是 760）`);
    else fail("分两步的累计误差", `变成了 ${toyAfter.cost}，离 760 太远`);
    const after = await auditEconomy(child.id);
    expect("调到位后的基准值", after.baseline, 38);
    expect("调到位后漂移倍数", after.drift, 1);
    if ((await recalibrationPreview(child.id)).rows.length === 0) pass("再校准一次没有任何变动（幂等）");
    else fail("校准幂等", "第二次仍然想改价");
    if (!after.findings.some((f) => f.title.includes("日薪从"))) pass("调到位后不再提示漂移");
    else fail("校准后", "还在提示漂移");

    // ---------- 花园：僵尸不再能被白嫖免疫 ----------
    // 原来"当天种过植物"= 完全免疫。但收获会清空 16 个格子、永远有空位，
    // 所以一天种一棵 8 阳光的向日葵就能永久免疫，而那 8 阳光收获时还连本带利还回来，
    // 免疫等于负成本白送——"任务没做完会有后果"这条规则实际上根本不存在。
    console.log("\n【花园】任务没做完必定被吃一棵，当天新种的挡在最前面");
    await prisma.child.update({
      where: { id: child.id },
      data: { theme: "GARDEN", gardenSettledThrough: dateStringToUtcDate(addDays(today, -2)) },
    });
    const mkPlant = (slot: number, title: string, daysAgo: number) =>
      prisma.plant.create({
        data: {
          childId: child.id,
          title,
          slot,
          status: "ALIVE",
          plantedOnDate: dateStringToUtcDate(addDays(today, -daysAgo)),
        },
      });
    const oldPlant = await mkPlant(0, "老向日葵", 5);
    // 判定的是"昨天"，所以"当天新种"对应 plantedOnDate = 昨天
    const freshPlant = await mkPlant(1, "昨天种的向日葵", 1);

    // 昨天的任务会被 ensureDailyTasksForDate 按模板补出来，全是 PENDING → 判定为没通过
    const gardenEvents = await settleGardenForChild(child.id);
    const eaten = gardenEvents.filter((e) => e.outcome === "PLANT_EATEN");
    if (eaten.length === 1) pass("当天种了植物也照样被吃了一棵（不再凭空免疫）");
    else fail("僵尸判定", `产生了 ${eaten.length} 条被吃事件，期望 1 条`);
    if (eaten[0] && "shielded" in eaten[0] && eaten[0].shielded) pass("事件标记为「新种的挡了一下」");
    else fail("shielded 标记", "没有标上");

    const [oldAfter, freshAfter] = await Promise.all([
      prisma.plant.findUniqueOrThrow({ where: { id: oldPlant.id } }),
      prisma.plant.findUniqueOrThrow({ where: { id: freshPlant.id } }),
    ]);
    expect("当天新种的那棵被吃", freshAfter.status, "EATEN");
    expect("养了 5 天的那棵还活着", oldAfter.status, "ALIVE");

    await prisma.plant.deleteMany({ where: { childId: child.id } });
    await prisma.child.update({
      where: { id: child.id },
      data: { gardenSettledThrough: null },
    });

    // ---------- 花园分级 ----------
    // 原来花园永远是 4×4、永远那四种植物，第 2 轮和第 20 轮一模一样。
    console.log("\n【花园】每收获几轮升一级：格子多一圈、解锁一种新植物");
    expect("各级边长", [...GARDEN_STAGES], [4, 5, 6]);
    expect(
      "第 1 级：4 种 × 各 4 棵 = 16 格",
      [gardenSetSize(1), gardenSize(1)],
      [4, 16]
    );
    expect("第 3 级：6 种 × 各 6 棵 = 36 格", [gardenSetSize(3), gardenSize(3)], [6, 36]);
    expect("越界的级数夹到最大级", gardenSide(99), 6);

    const activeAtStart = await prisma.plantType.count({
      where: { childId: child.id, active: true },
    });
    expect("新建档案默认上架的植物种类", activeAtStart, gardenSetSize(1));

    if ((await checkGardenStageUp(child.id)) === null) pass("一轮都没收获时不会升级");
    else fail("零收获升级", "居然升级了");

    // 伪造够数的收获流水（真跑一轮要种满 16 棵，这里只验升级判定本身）
    for (let i = 0; i < HARVEST_ROUNDS_PER_STAGE; i++) {
      await prisma.pointsLedger.create({
        data: { childId: child.id, amount: 1, reason: `假收获 ${i}`, type: "GARDEN_BONUS" },
      });
    }
    const up = await checkGardenStageUp(child.id);
    expect(`收获满 ${HARVEST_ROUNDS_PER_STAGE} 轮后升到`, up?.stage, 2);
    expect("新边长", up?.side, 5);
    expect("顺带解锁的新植物", up?.unlockedPlant, "寒冰射手");
    expect(
      "上架种类数跟着变成 5",
      await prisma.plantType.count({ where: { childId: child.id, active: true } }),
      5
    );
    if ((await checkGardenStageUp(child.id)) === null) pass("轮数不够下一级时不会连升（幂等）");
    else fail("连续升级", "又升了一级");

    // 没有可解锁的品种时**不能**升级——升上去就是个永远集不齐的死局
    for (let i = 0; i < HARVEST_ROUNDS_PER_STAGE; i++) {
      await prisma.pointsLedger.create({
        data: { childId: child.id, amount: 1, reason: `假收获 b${i}`, type: "GARDEN_BONUS" },
      });
    }
    await prisma.plantType.updateMany({
      where: { childId: child.id, active: false },
      data: { active: true },
    });
    const blocked = await prisma.plantType.findMany({ where: { childId: child.id } });
    await prisma.plantType.updateMany({
      where: { childId: child.id, title: "大嘴花" },
      data: { active: true },
    });
    if ((await checkGardenStageUp(child.id)) === null) pass("没有可解锁的新品种时拒绝升级");
    else fail("死局保护", `在只有 ${blocked.length} 种植物时仍然升了级`);

    await prisma.pointsLedger.deleteMany({
      where: { childId: child.id, type: "GARDEN_BONUS" },
    });
    await prisma.child.update({
      where: { id: child.id },
      data: { theme: "POKEDEX", gardenStage: 1 },
    });

    // ---------- 打卡等级 ----------
    // 等级只能反映"干了多少活"。算进花园收获/图鉴奖励的话，花园孩子刷一轮就升级、
    // 图鉴孩子净吞 56% 反而升得慢，同一张等级表对两个主题就不公平了。
    console.log("\n【等级】只算打卡挣的阳光，且只增不减");
    if (LEVELS.every((l, i) => i === 0 || l.need > LEVELS[i - 1].need)) pass("门槛严格递增");
    else fail("等级门槛", "不是严格递增的");
    expect("Lv1 门槛是 0", LEVELS[0].need, 0);
    expect("空账号是 1 级", levelForEarned(0), 1);
    expect(`挣满 ${LEVELS[1].need} 到 2 级`, levelForEarned(LEVELS[1].need), 2);
    expect("差 1 点不升级", levelForEarned(LEVELS[1].need - 1), 1);
    expect("挣爆表也不超过最高级", levelForEarned(9_999_999), MAX_LEVEL);
    expect("满级后没有下一级门槛", levelProgress(MAX_LEVEL, 9_999_999).next, null);

    await prisma.pointsLedger.deleteMany({ where: { childId: child.id } });
    const earn = (amount: number, type: "TASK_COMPLETE" | "GARDEN_BONUS" | "POKEDEX_BONUS" | "MANUAL_ADJUST" | "TASK_REVOKE") =>
      prisma.pointsLedger.create({ data: { childId: child.id, amount, reason: "等级测试", type } });

    await earn(100, "TASK_COMPLETE");
    await earn(5000, "GARDEN_BONUS");
    await earn(5000, "POKEDEX_BONUS");
    await earn(5000, "MANUAL_ADJUST");
    expect("花园/图鉴/手动加分都不计入等级", await totalEarned(child.id), 100);

    await earn(-30, "TASK_REVOKE");
    expect("撤销打卡从累计里扣掉", await totalEarned(child.id), 70);

    await earn(LEVELS[2].need, "TASK_COMPLETE");
    const lvUp = await checkLevelUp(child.id);
    expect("挣够之后升级到", lvUp?.level, 3);
    expect("称号", lvUp?.title, LEVELS[2].title);
    if ((await checkLevelUp(child.id)) === null) pass("再调一次不重复升级（幂等）");
    else fail("升级幂等", "又升了一次");

    // 只增不减：把累计值砍回去，等级不能掉
    await earn(-LEVELS[2].need, "TASK_REVOKE");
    expect("撤销后累计值回落", await totalEarned(child.id), 70);
    await checkLevelUp(child.id);
    expect(
      "等级不会掉回去",
      (await prisma.child.findUniqueOrThrow({ where: { id: child.id } })).level,
      3
    );

    // 路线图：15 级全在，位置标记正确。
    // 这里**不该有"解锁什么"**——等级是纯称号系统，加过两轮解锁都撤回了
    // （礼物是家长和孩子的约定；精灵球本来就用价格分了档）。
    const roadmap = getLevelRoadmap(2);
    expect("路线图覆盖全部等级", roadmap.length, MAX_LEVEL);
    expect("已达成的标记", roadmap.filter((r) => r.reached).map((r) => r.level), [1, 2]);
    expect("当前那一级", roadmap.find((r) => r.current)?.level, 2);
    expect("每一级都有称号", roadmap.every((r) => r.title.length > 0), true);

    await prisma.pointsLedger.deleteMany({ where: { childId: child.id } });
    await prisma.child.update({ where: { id: child.id }, data: { level: 1 } });

    // ---------- 6. 图鉴分地区解锁 ----------
    console.log("\n【图鉴】按收集进度分地区解锁");
    expect("初始地区上限", regionCeiling(child.pokedexRegion), REGIONS[0].ceiling);
    if ((await checkRegionUnlock(child.id)) === null) pass("一只都没抓时不会解锁");
    else fail("空收集时解锁", "居然解锁了");

    // 灌够 80% 的关都宝可梦
    const need = Math.ceil(REGIONS[0].ceiling * REGION_UNLOCK_RATIO);
    const species = await prisma.pokemonSpecies.findMany({
      where: { id: { lte: REGIONS[0].ceiling } },
      take: need,
      orderBy: { id: "asc" },
    });
    if (species.length < need) {
      fail("图鉴库", `只有 ${species.length} 只关都宝可梦，不够 ${need}，先跑 npm run db:seed-pokedex`);
    } else {
      await prisma.caught.createMany({
        data: species.map((s) => ({
          childId: child.id,
          speciesId: s.id,
          nameZh: s.nameZh,
          types: s.types,
          rarity: s.rarity,
          gender: Gender.UNKNOWN,
          ability: "测试",
          moveName: s.moveName,
          movePower: s.movePower,
          hp: s.hp,
          attack: s.attack,
          defense: s.defense,
          speed: s.speed,
          ballTier: "POKE" as const,
          artUrl: s.artUrl,
          status: CaughtStatus.OWNED,
          caughtOnDate: todayAsUtcDate(),
        })),
      });
      const unlocked = await checkRegionUnlock(child.id);
      expect(`收集满 ${need}/151 后解锁`, unlocked?.name, REGIONS[1].name);
      const reread = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
      expect("Child.pokedexRegion", reread.pokedexRegion, 2);
      if ((await checkRegionUnlock(child.id)) === null) pass("再调一次不会重复解锁（幂等）");
      else fail("解锁幂等", "又解锁了一次");

      // 新地区的宝可梦要真的能遇到：连摇 40 天，至少出现一只 id>151 的
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      let sawNewRegion = false;
      for (let i = 0; i < 40 && !sawNewRegion; i++) {
        const date = `2099-01-${String((i % 28) + 1).padStart(2, "0")}`;
        await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
        await ensureTodayEncounters(child.id, date);
        const encs = await prisma.dailyEncounter.findMany({ where: { childId: child.id } });
        if (encs.some((e) => e.speciesId > REGIONS[0].ceiling)) sawNewRegion = true;
      }
      if (sawNewRegion) pass("解锁后能遇到城都地区的宝可梦");
      else fail("城都宝可梦", "摇了 40 天一只都没出现");
    }
  } finally {
    // 清理本身失败也不能静默：兜底再扫一次，还失败就把话说清楚，别让人以为库是干净的
    try {
      await destroyTenant(child.id, user.id);
      console.log("\n临时租户已清理。");
    } catch (error) {
      console.error("\n清理临时租户失败，尝试兜底清扫：", error);
      const n = await purgeTestTenants(MARK).catch(() => -1);
      console.log(n >= 0 ? `兜底清扫掉了 ${n} 个。` : "⚠️ 兜底也失败了，请手工检查库里的 __econ_check__ 账号。");
    }
  }

  if (failures > 0) {
    console.log(`\n❌ ${failures} 项经济检查未通过`);
    process.exit(1);
  }
  console.log("\n✅ 全部经济检查通过");
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
