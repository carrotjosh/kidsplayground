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
 * 悄悄踩穿"扔球不能赚钱""球价要有梯度"这类前提，而那些错误在界面上完全看不出来。
 */
import "dotenv/config";

import { hashPassword } from "../src/lib/auth";
import { seedDefaultsForChild } from "../src/lib/bootstrap";
import { ScheduleType } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import { approveDailyTask, submitDailyTaskForReview } from "../src/lib/tasks";
import { purgeTestTenants } from "../src/lib/testTenant";
import { addDays, dateStringToUtcDate, formatStoredDate, todayDateString } from "../src/lib/date";
import {
  AMOUNT_MULTIPLIERS,
  economyRate,
  maxDailyPoints,
  maxDailyPointsFromTemplates,
  pokedexMilestoneStep,
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
  ensureTodayEncounters,
  settlePokedexForChild,
  throwBall,
  refreshEncounters,
  REGIONS,
  regionAt,
  SPECIES_CEILING_BY_LEVEL,
  speciesCeilingForLevel,
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
    prisma.dailyTask.deleteMany({ where: { childId } }),
    prisma.reward.deleteMany({ where: { childId } }),
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
  console.log("\n【任务总分】按真实日历逐天算，不是按 5/7、2/7 拍（这是理论上限，不是定价基准）");
  const daily = (points: number, weekdays: number[]) => ({
    points,
    scheduleType: ScheduleType.WEEKDAYS,
    weekdays,
  });
  expect(
    "默认三项任务(10+10+5，每天)",
    maxDailyPointsFromTemplates([
      daily(10, [0, 1, 2, 3, 4, 5, 6]),
      daily(10, [0, 1, 2, 3, 4, 5, 6]),
      daily(5, [0, 1, 2, 3, 4, 5, 6]),
    ]),
    25
  );
  expect("只排周一到周五、每次 7 分", maxDailyPointsFromTemplates([daily(7, [1, 2, 3, 4, 5])]), 5);
  expect("只排周末、每次 14 分", maxDailyPointsFromTemplates([daily(14, [0, 6])]), 4);
  expect("没有任何模板", maxDailyPointsFromTemplates([]), 0);

  // ---------- 2. 按日薪派生的金额 ----------
  // 这一组是回归测试：改造前它们是硬编码常量，改造后必须一模一样，
  // 否则等于在孩子毫不知情的情况下改了他的奖励。
  console.log("\n【派生金额】日薪 25 时必须和改造前的硬编码完全一致");
  expect("月度满勤奖", monthlyBonusPoints(25), 150);
  // 这一条**故意偏离**改造前的硬编码 100，是本轮唯一的例外。
  //
  // 原来是 4 天工资。模拟 3000 次拿下一个里程碑的真实成本发现，前 11 个里程碑
  // （差不多第一年多）扔球一路净赚——图鉴从阳光的消耗口变成了产出口，
  // 直接踩穿"扔球不能赚钱"那条不变量。真实案例：蓬蓬头 10 天做任务挣 172，
  // 一次里程碑就发了 192。
  //
  // 1.5 是倒推的：里程碑摊到每个球是 M × p̄ / 8，要 ≤ 球价 8 × 0.5，解出 M ≤ 87。
  // 又从 1.5 降到 0.8：1.5 虽然不再让扔球赚钱，但仍盖过打卡本身——
  // 日薪是"全部任务都完成"的理论值，蓬蓬实际完成率约 35%，
  // 72 阳光等于他四天的真实收入。0.8 天工资 ≈ 5 个精灵球，是「拍肩」不是「收入」。
  expect("图鉴里程碑（4 → 1.5 → 0.8 天工资）", pokedexMilestoneBonus(25), 20);
  expect(
    "单种收集完成",
    [1, 2, 3, 4].map((r) => speciesMasteryBonus(25, r)),
    [40, 80, 150, 500]
  );
  // 刷新中间那档原来是 12，现在 0.5×25=12.5 四舍五入成 13。差 1 阳光，可以接受。
  expect("刷新费（第二档由 12 变 13，四舍五入）", refreshCosts(25), [5, 13, 25]);

  console.log("\n【派生金额】日薪变了要自动跟上");
  expect("日薪 38 的满勤奖", monthlyBonusPoints(38), 228);
  expect("日薪 38 的刷新费", refreshCosts(38), [8, 19, 38]);
  // 一个任务都没有时 D=0，刷新费不能变成 0——那样孩子可以无限白嫖刷新
  if (refreshCosts(0).every((c) => c >= 1)) pass("日薪 0 时刷新费仍 ≥1，不会白嫖");
  else fail("日薪 0 时的刷新费", `是 ${refreshCosts(0)}`);

  const today = todayDateString();
  const { user, child } = await createTenant();
  try {
    // ---------- 3. 干净状态 ----------
    console.log("\n【体检】默认配置应该是干净的");
    // 基准 = 达标线，不再是任务分值之和。默认档案达标线 20、任务总分 25。
    expect("默认基准（达标线）", await economyRate(child.id), 20);
    expect("默认任务总分（理论上限）", await maxDailyPoints(child.id), 25);
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

    // (1a) 好球贵得不成比例 → 孩子不会买，"选哪个球"的决策失效
    const great = await prisma.ballType.findFirstOrThrow({
      where: { childId: child.id, tier: "GREAT" },
    });
    await prisma.ballType.update({ where: { id: great.id }, data: { cost: 60 } });
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "贵得不成比例",
      "超级球抬到 60 → 报出「好球买了就是亏」"
    );
    await prisma.ballType.update({ where: { id: great.id }, data: { cost: great.cost } });
    if (!(await auditEconomy(child.id)).findings.some((f) => f.title.includes("贵得不成比例"))) {
      pass("默认球价（8/16/33）的梯度是合理的");
    } else {
      fail("默认球价", "被判定成不成比例");
    }

    // (1b) 里程碑太高 → 扔球刷里程碑就能赚阳光
    //
    // 这条是补上去的：原来"扔球不能赚钱"只校验重复返还，而前期几乎没有重复
    // （抓到的都是新种），真正踩穿它的是里程碑。加之前那一版体检对
    // 4 天工资的里程碑一声不吭。
    const okMilestone = await auditEconomy(child.id);
    if (okMilestone.findings.some((f) => f.title.includes("里程碑太高"))) {
      fail("当前里程碑值", "被误报成太高了");
    } else {
      pass("当前里程碑（0.8 天工资）不会让扔球变成赚钱手段");
    }

    // 调大到真会踩穿的程度，必须报出来。
    //
    // 为什么不是用当初那个 4：上限由**球价**定死（M × p̄ / 8 ≤ 8 × 0.5 → M ≤ 87），
    // 而基准换成达标线之后 D 从 48 降到 20，4 倍只有 80，反而落在安全线内。
    // 当初 4 会出事是因为 D 被算成了 48——这也从侧面说明换锚顺带治了那个病。
    // 这里用 6（=120）来验证守卫本身还活着。
    const origMilestone = AMOUNT_MULTIPLIERS.pokedexMilestone;
    (AMOUNT_MULTIPLIERS as { pokedexMilestone: number }).pokedexMilestone = 6;
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "里程碑太高",
      "里程碑调到 6 天工资 → 报出「刷里程碑能赚阳光」"
    );
    (AMOUNT_MULTIPLIERS as { pokedexMilestone: number }).pokedexMilestone = origMilestone;

    // (3) 达标线高过日薪 → 永远达不了标
    await prisma.child.update({ where: { id: child.id }, data: { dailyGoalPoints: 99 } });
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "高于任务总分",
      "达标线 99 > 任务总分 25 → 报出「永远达不了标」"
    );
    await prisma.child.update({ where: { id: child.id }, data: { dailyGoalPoints: 20 } });

    // (4) 眼前没有够得着的东西（原来盯的是"最贵的太贵"，那是错的方向：
    //     家长可能故意放一个攒大半年的大目标）
    const rewardCosts = await prisma.reward.findMany({
      where: { childId: child.id, cost: { gt: 0 } },
      select: { id: true, cost: true },
    });
    await prisma.reward.updateMany({
      where: { childId: child.id, cost: { gt: 0 } },
      data: { cost: 2000 },
    });
    expectFinding(
      (await auditEconomy(child.id)).findings,
      "最便宜的礼物",
      "所有礼物都要攒很久 → 报出「眼前没有够得着的」"
    );
    // 全部还原——只还原最便宜那个的话，后面的校准测试会拿着被改成 2000 的玩具算
    await prisma.$transaction(
      rewardCosts.map((r) => prisma.reward.update({ where: { id: r.id }, data: { cost: r.cost } }))
    );

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
    expect("加一门 13 分的任务后，任务总分涨到", await maxDailyPoints(child.id), 38);
    // 这是换锚之后最重要的一条：**加任务不再产生任何漂移**。
    // 旧口径下基准会从 25 跳到 38，所有价格瞬间"便宜了 34%"，而家长什么也没改。
    expect("加任务后基准纹丝不动", await economyRate(child.id), 20);
    if (!(await auditEconomy(child.id)).findings.some((f) => f.title.includes("基准从"))) {
      pass("加任务不产生漂移提示（这正是换锚要解决的问题）");
    } else {
      fail("加任务", "仍然报了漂移");
    }

    // 漂移只能由**家长主动提高期待**触发：达标线 20 → 30
    await prisma.child.update({ where: { id: child.id }, data: { dailyGoalPoints: 30 } });
    const drifted = await auditEconomy(child.id);
    expectFinding(drifted.findings, "基准从 20 变成了 30", "调高达标线 → 报出漂移");

    const preview = await recalibrationPreview(child.id);
    expect("校准倍数", Number(preview.factor.toFixed(2)), 1.5);
    // 达标线自己不能进校准清单——基准就是它，缩放它等于自己改自己
    if (!preview.rows.some((r) => r.kind === "dailyGoal")) pass("达标线不参与校准（否则会自己推自己）");
    else fail("校准清单", "把达标线也算进去了");
    const toyBefore = await prisma.reward.findFirstOrThrow({
      where: { childId: child.id, title: "一个小玩具" },
    });
    const toyRow = preview.rows.find((r) => r.label === "一个小玩具");
    expect("预览里「一个小玩具」500 →", toyRow?.to, 750);
    // 零成本礼物不该出现在预览里：它们是刻意不花阳光的一档，不是"很便宜"
    if (!preview.rows.some((r) => r.from === 0)) pass("零成本礼物不参与校准");
    else fail("零成本礼物", "被算进了校准");

    // 直接调 lib 层做校准（action 需要会话上下文，脚本里造不出来）。
    // 这段必须和 economy/actions.ts 的 recalibrateAction 保持一致，
    // 尤其是**基准值写的是 `原基准 × 倍数` 而不是当前日薪**——部分校准全靠这一点才诚实。
    async function calibrate(factor: number) {
      const scale = (n: number) => Math.max(1, Math.round(n * factor));
      const c = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
      const [rewards, balls] = await Promise.all([
        prisma.reward.findMany({ where: { childId: child.id, cost: { gt: 0 } } }),
        prisma.ballType.findMany({ where: { childId: child.id } }),
      ]);
      await prisma.$transaction([
        ...rewards.map((r) =>
          prisma.reward.update({ where: { id: r.id }, data: { cost: scale(r.cost) } })
        ),
        ...balls.map((b) =>
          prisma.ballType.update({ where: { id: b.id }, data: { cost: scale(b.cost) } })
        ),
        prisma.child.update({
          where: { id: child.id },
          // 只动基准值，不动达标线——和 economy/actions.ts 的 recalibrateAction 一致
          data: { priceBaselineRate: scale(c.priceBaselineRate) },
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
    expect("基准值 20 → 23（不是直接跳到 30）", partial.baseline, 23);
    expect("剩余漂移", Number(partial.drift.toFixed(2)), 1.3);
    expectFinding(partial.findings, "基准从 23 变成了 30", "仍然如实提示还剩多少没调");

    // ---- 再调到位 ----
    const rate = await economyRate(child.id);
    await calibrate(rate / partial.baseline);
    const toyAfter = await prisma.reward.findUniqueOrThrow({ where: { id: toyBefore.id } });
    // 分两步走会因为中间四舍五入和一步到位差几个阳光（760 vs 754），这是可以接受的
    if (Math.abs(toyAfter.cost - 750) <= 10) pass(`分两步调完「一个小玩具」= ${toyAfter.cost}（一步是 750）`);
    else fail("分两步的累计误差", `变成了 ${toyAfter.cost}，离 750 太远`);
    const after = await auditEconomy(child.id);
    expect("调到位后的基准值", after.baseline, 30);
    expect("调到位后漂移倍数", after.drift, 1);
    if ((await recalibrationPreview(child.id)).rows.length === 0) pass("再校准一次没有任何变动（幂等）");
    else fail("校准幂等", "第二次仍然想改价");
    if (!after.findings.some((f) => f.title.includes("基准从"))) pass("调到位后不再提示漂移");
    else fail("校准后", "还在提示漂移");

    // ---------- 图鉴里程碑可配置 ----------
    console.log("\n【里程碑】金额和步长都能被家长固定住");
    expect("不设置时跟着基准走（基准 20 × 0.8）", pokedexMilestoneBonus(20), 16);
    expect("设置了就用设置的，不再随基准浮动", pokedexMilestoneBonus(20, 50), 50);
    expect("基准变了也不动", pokedexMilestoneBonus(99, 50), 50);
    expect("设成 0 或负数视为没设", pokedexMilestoneBonus(20, 0), 16);
    expect("步长默认 8", pokedexMilestoneStep(null), 8);
    expect("步长可覆写", pokedexMilestoneStep(12), 12);

    // ---------- 抓到重复不再返还阳光 ----------
    //
    // 2026-09-28 取消。家长的判断：抓哪一只是孩子自己选的，名单每天公开，
    // 他明知道是重复还要扔球，那就是他想要的，系统不用再补一笔。
    console.log("\n【重复】抓到已有的种类不再产生任何阳光流水");
    {
      // 不靠随机撞重复——遇怪生成里有 UNSEEN_BIAS「偏向没抓到过的」，
      // 随机跑十几轮也未必撞得上。直接把遇怪那一行改成一个已经拥有的种类，
      // 测的是"抓到重复之后有没有发阳光"，不该被抓取运气干扰。
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      await prisma.caught.deleteMany({ where: { childId: child.id } });
      await prisma.pointsLedger.create({
        data: { childId: child.id, amount: 500, reason: "自检垫款", type: "MANUAL_ADJUST" },
      });
      const poke = await prisma.ballType.findFirstOrThrow({
        where: { childId: child.id, tier: "POKE" },
      });
      // 抓取力拉满，保证必中——这里测的是返还，不是抓不抓得到
      await prisma.ballType.update({ where: { id: poke.id }, data: { catchPower: 99 } });

      const day = todayDateString();
      await ensureTodayEncounters(child.id, day);
      const first = await prisma.dailyEncounter.findFirstOrThrow({
        where: { childId: child.id },
        orderBy: { slot: "asc" },
      });
      await throwBall(first.id, poke.id, child.id);
      const owned = await prisma.caught.findFirstOrThrow({
        where: { childId: child.id, status: "OWNED" },
      });

      // 再造一只遇怪，硬改成同一个种类
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      await ensureTodayEncounters(child.id, day);
      const second = await prisma.dailyEncounter.findFirstOrThrow({
        where: { childId: child.id },
        orderBy: { slot: "asc" },
      });
      await prisma.dailyEncounter.update({
        where: { id: second.id },
        data: { speciesId: owned.speciesId, nameZh: owned.nameZh, rarity: owned.rarity },
      });

      const dupBefore = await prisma.pointsLedger.count({
        where: { childId: child.id, type: "POKEDEX_DUPLICATE" },
      });
      const balBefore =
        (await prisma.pointsLedger.aggregate({
          where: { childId: child.id },
          _sum: { amount: true },
        }))._sum.amount ?? 0;

      await throwBall(second.id, poke.id, child.id);

      const sameCount = await prisma.caught.count({
        where: { childId: child.id, speciesId: owned.speciesId, status: "OWNED" },
      });
      expect("确实抓到了第二只同种（测试前提成立）", sameCount, 2);
      expect(
        "重复返还流水条数",
        (await prisma.pointsLedger.count({
          where: { childId: child.id, type: "POKEDEX_DUPLICATE" },
        })) - dupBefore,
        0
      );
      // 余额只应该减少一个球钱（这一档还没到「单种集齐」的门槛，不会有别的进账）
      const balAfter =
        (await prisma.pointsLedger.aggregate({
          where: { childId: child.id },
          _sum: { amount: true },
        }))._sum.amount ?? 0;
      expect("抓到重复后余额变化（只扣一个球钱）", balAfter - balBefore, -poke.cost);

      await prisma.ballType.update({
        where: { id: poke.id },
        data: { catchPower: poke.catchPower },
      });
      await prisma.caught.deleteMany({ where: { childId: child.id } });
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
    }

    // ---------- 自动审批 ----------
    //
    // 重点盯 submittedAt。自觉性面板（lib/discipline.ts）靠它区分
    // "孩子当天自己点的" 和 "家长事后补批的"。自动审批只是省掉家长那一下，
    // 孩子确实是自己点的——漏写的话，一开自动审批自觉率就掉到 0，
    // 而这在界面上完全看不出来（数字就是会慢慢变难看而已）。
    console.log("\n【自动审批】开了之后直接到账，且仍记为孩子自己提交");
    await prisma.child.update({ where: { id: child.id }, data: { theme: "POKEDEX" } });

    const mkTask = (title: string, points: number) =>
      prisma.dailyTask.create({
        data: {
          childId: child.id,
          title,
          points,
          date: dateStringToUtcDate(today),
          source: "ADHOC",
          status: "PENDING",
        },
      });

    // 关着：走待审核，不发阳光
    await prisma.child.update({ where: { id: child.id }, data: { autoApprove: false } });
    const t1 = await mkTask("自检-要审批", 7);
    const before = (await prisma.pointsLedger.aggregate({
      where: { childId: child.id }, _sum: { amount: true },
    }))._sum.amount ?? 0;
    const r1 = await submitDailyTaskForReview(t1.id, child.id);
    expect("关着时进待审核", r1.status, "PENDING_REVIEW");
    expect(
      "关着时不发阳光",
      ((await prisma.pointsLedger.aggregate({ where: { childId: child.id }, _sum: { amount: true } }))._sum.amount ?? 0) - before,
      0
    );

    // 开着：直接 DONE 并发阳光
    await prisma.child.update({ where: { id: child.id }, data: { autoApprove: true } });
    const t2 = await mkTask("自检-自动批", 9);
    const r2 = await submitDailyTaskForReview(t2.id, child.id);
    expect("开着时直接完成", r2.status, "DONE");
    expect(
      "开着时阳光立刻到账",
      ((await prisma.pointsLedger.aggregate({ where: { childId: child.id }, _sum: { amount: true } }))._sum.amount ?? 0) - before,
      9
    );
    const t2row = await prisma.dailyTask.findUniqueOrThrow({ where: { id: t2.id } });
    if (t2row.submittedAt) pass("自动审批仍然记下 submittedAt（自觉性面板不会被清零）");
    else fail("submittedAt", "自动审批没记，自觉率会掉到 0");

    // 重复点不重复发
    await submitDailyTaskForReview(t2.id, child.id);
    expect(
      "连点两次也只发一次",
      ((await prisma.pointsLedger.aggregate({ where: { childId: child.id }, _sum: { amount: true } }))._sum.amount ?? 0) - before,
      9
    );

    // 开开关不会自动放行已经压着的那条
    expect(
      "开启前就在待审核的那条不受影响",
      (await prisma.dailyTask.findUniqueOrThrow({ where: { id: t1.id } })).status,
      "PENDING_REVIEW"
    );

    await prisma.pointsLedger.deleteMany({ where: { childId: child.id, dailyTaskId: t2.id } });
    await prisma.dailyTask.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
    await prisma.child.update({ where: { id: child.id }, data: { autoApprove: false } });

    // ---------- 逃跑规则：当天挣到不到 5 阳光才跑 ----------
    console.log("\n【逃跑】当天挣到的阳光不到 FLEE_EARN_THRESHOLD 才跑，和有没有抓到无关");
    {
      const yesterday = addDays(todayDateString(), -1);
      const savedTemplates = await prisma.taskTemplate.findMany({ where: { childId: child.id } });
      const savedTasks = await prisma.dailyTask.findMany({ where: { childId: child.id } });
      const reset = async () => {
        await prisma.dailyTask.deleteMany({ where: { childId: child.id } });
        await prisma.taskTemplate.deleteMany({ where: { childId: child.id } });
        await prisma.caught.deleteMany({ where: { childId: child.id } });
        await prisma.pointsLedger.deleteMany({ where: { childId: child.id } });
        await prisma.child.update({
          where: { id: child.id },
          data: { theme: "POKEDEX", penaltyEnabled: true, settledThrough: dateStringToUtcDate(addDays(yesterday, -1)) },
        });
        await prisma.caught.create({
          data: {
            childId: child.id, speciesId: 25, nameZh: "皮卡丘", types: ["electric"], rarity: 1,
            artUrl: "", gender: "UNKNOWN", ability: "测试", moveName: "测试", movePower: 1,
            hp: 1, attack: 1, defense: 1, speed: 1, ballTier: "POKE", status: "OWNED",
            caughtOnDate: dateStringToUtcDate(addDays(yesterday, -1)),
          },
        });
      };
      const seedDay = async (points: number[]) => {
        await prisma.dailyTask.createMany({
          data: points.map((pts, i) => ({
            childId: child.id, title: `自检${i}`, points: pts, source: "ADHOC" as const,
            date: dateStringToUtcDate(yesterday), status: pts > 0 ? "DONE" as const : "PENDING" as const,
          })),
        });
      };

      await reset(); await seedDay([4]);
      const ev1 = await settlePokedexForChild(child.id);
      expect("挣到 4（不到 5）→ 跑一只", ev1.filter((e) => e.outcome === "FLED_AWAY").length, 1);

      await reset(); await seedDay([5]);
      const ev2 = await settlePokedexForChild(child.id);
      expect("挣到刚好 5 → 不跑", ev2.filter((e) => e.outcome === "FLED_AWAY").length, 0);

      await reset(); await seedDay([0]);
      const ev3 = await settlePokedexForChild(child.id);
      expect("一分都没挣 → 跑", ev3.filter((e) => e.outcome === "FLED_AWAY").length, 1);

      // 已经不再有「当天抓到就免疫」：有 caught 行但挣得少，照样跑
      await reset(); await seedDay([3]);
      const ev4 = await settlePokedexForChild(child.id);
      expect("挣得少、即使当天抓到过也跑（免疫已取消）", ev4.filter((e) => e.outcome === "FLED_AWAY").length, 1);

      await reset();
      await prisma.child.update({ where: { id: child.id }, data: { penaltyEnabled: false } });
      await seedDay([0]);
      const ev5 = await settlePokedexForChild(child.id);
      expect("惩罚关掉 → 挣 0 也不跑", ev5.filter((e) => e.outcome === "FLED_AWAY").length, 0);
      // 补批：昨天挣 4 → 跑一只；之后补一项 2 分的任务批准 → 总共 6 → 接回来
      await reset(); await seedDay([4]);
      const fledEv = await settlePokedexForChild(child.id);
      expect("补批前：昨天挣 4 跑了一只", fledEv.filter((e) => e.outcome === "FLED_AWAY").length, 1);
      const late = await prisma.dailyTask.create({
        data: {
          childId: child.id, title: "补的一项", points: 2, source: "ADHOC",
          date: dateStringToUtcDate(yesterday), status: "PENDING_REVIEW",
        },
      });
      await approveDailyTask(late.id, child.id);
      expect(
        "补批到 6 阳光 → 跑掉的那只回来了",
        await prisma.caught.count({ where: { childId: child.id, status: "FLED" } }),
        0
      );

      // 补批后还是不够 5 → 不接回来
      await reset(); await seedDay([4]);
      await settlePokedexForChild(child.id);
      const small = await prisma.dailyTask.create({
        data: {
          childId: child.id, title: "补的小项", points: 0, source: "ADHOC",
          date: dateStringToUtcDate(yesterday), status: "PENDING_REVIEW",
        },
      });
      await approveDailyTask(small.id, child.id);
      expect(
        "补批后仍然不够 5 → 不接回来",
        await prisma.caught.count({ where: { childId: child.id, status: "FLED" } }),
        1
      );

      // 有一天的任务已经点了「做完了」但家长还没批：不判，游标也不动
      await reset();
      await prisma.dailyTask.create({
        data: {
          childId: child.id, title: "等批的", points: 3, source: "ADHOC",
          date: dateStringToUtcDate(yesterday), status: "PENDING_REVIEW",
        },
      });
      const beforeCursor = (await prisma.child.findUniqueOrThrow({ where: { id: child.id } })).settledThrough;
      const waitEv = await settlePokedexForChild(child.id);
      expect("已提交没批：当天不判（不跑）", waitEv.filter((e) => e.outcome === "FLED_AWAY").length, 0);
      const afterCursor = (await prisma.child.findUniqueOrThrow({ where: { id: child.id } })).settledThrough;
      expect("已提交没批：游标没有越过这一天", afterCursor?.getTime() === beforeCursor?.getTime(), true);

      // 恢复原样
      await prisma.dailyTask.deleteMany({ where: { childId: child.id } });
      await prisma.taskTemplate.deleteMany({ where: { childId: child.id } });
      if (savedTemplates.length) await prisma.taskTemplate.createMany({ data: savedTemplates });
      if (savedTasks.length) await prisma.dailyTask.createMany({ data: savedTasks });
      await prisma.caught.deleteMany({ where: { childId: child.id } });
      await prisma.child.update({ where: { id: child.id }, data: { settledThrough: null } });
    }

    // ---------- 惩罚开关：关掉之后游标仍然要走 ----------
    //
    // 这是整个开关**唯一真正危险**的地方。如果靠"不调用结算函数"来关，
    // 游标会停在原地；家长关一个月再打开，那一刻会把 30 天一次性补判，
    // 一口气跑掉一串宝可梦——比不关还糟，而且家长完全预料不到。
    // 所以断言两件事：关闭期间不产生惩罚，且**游标照样推进到昨天**。
    console.log("\n【惩罚开关】关掉之后不惩罚，但游标必须照常推进");
    await prisma.dailyTask.deleteMany({ where: { childId: child.id } });
    await prisma.caught.deleteMany({ where: { childId: child.id } });
    await prisma.caught.create({
      data: {
        childId: child.id, speciesId: 25, nameZh: "皮卡丘", types: ["electric"], rarity: 1,
        artUrl: "", gender: "UNKNOWN", ability: "测试", moveName: "测试", movePower: 1,
        hp: 1, attack: 1, defense: 1, speed: 1, ballTier: "POKE", status: "OWNED",
        caughtOnDate: dateStringToUtcDate(addDays(today, -10)),
      },
    });
    await prisma.child.update({
      where: { id: child.id },
      data: {
        penaltyEnabled: false,
        settledThrough: dateStringToUtcDate(addDays(today, -6)),
      },
    });
    const offEvents = await settlePokedexForChild(child.id);
    expect("关闭期间的惩罚事件数", offEvents.filter((e) => e.outcome === "FLED_AWAY").length, 0);
    expect(
      "关闭期间宝可梦还在",
      await prisma.caught.count({ where: { childId: child.id, status: "OWNED" } }),
      1
    );
    const afterOff = await prisma.child.findUniqueOrThrow({ where: { id: child.id } });
    expect(
      "游标已推进到昨天（重新打开时不会被一次性补罚）",
      afterOff.settledThrough && formatStoredDate(afterOff.settledThrough),
      addDays(today, -1)
    );

    // 打开之后照常惩罚，而且只从现在往后算
    await prisma.child.update({
      where: { id: child.id },
      data: { penaltyEnabled: true, settledThrough: dateStringToUtcDate(addDays(today, -2)) },
    });
    const onEvents = await settlePokedexForChild(child.id);
    expect("重新打开后恢复惩罚", onEvents.filter((e) => e.outcome === "FLED_AWAY").length, 1);

    await prisma.caught.deleteMany({ where: { childId: child.id } });
    await prisma.child.update({ where: { id: child.id }, data: { settledThrough: null } });

    // ---------- 打卡等级 ----------
    // 等级只能反映"干了多少活"。算进图鉴奖励的话，孩子靠扔球刷奖励就能升级。
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
    const earn = (amount: number, type: "TASK_COMPLETE" | "POKEDEX_BONUS" | "MANUAL_ADJUST" | "TASK_REVOKE") =>
      prisma.pointsLedger.create({ data: { childId: child.id, amount, reason: "等级测试", type } });

    await earn(100, "TASK_COMPLETE");
    await earn(5000, "POKEDEX_BONUS");
    await earn(5000, "MANUAL_ADJUST");
    expect("图鉴/手动加分都不计入等级", await totalEarned(child.id), 100);

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

    // ---------- 图鉴按等级放出 ----------
    // 这里守着一条硬约束：**上限不能低于 151**。第一只传说是 #144，
    // 上限低于它的话传说那一档一只都没有，摇到传说会退回随机挑一只普通的，
    // 稀有度体系静默失效——这种错在界面上完全看不出来。
    console.log("\n【图鉴】开放到第几号由打卡等级决定");
    expect("等级表长度和图鉴上限表一致", SPECIES_CEILING_BY_LEVEL.length, MAX_LEVEL);
    expect("Lv.1 就给满关都", speciesCeilingForLevel(1), 151);
    expect("满级开放全部", speciesCeilingForLevel(MAX_LEVEL), 386);
    expect("越界夹取", [speciesCeilingForLevel(0), speciesCeilingForLevel(99)], [151, 386]);
    if (SPECIES_CEILING_BY_LEVEL.every((c, i) => i === 0 || c > SPECIES_CEILING_BY_LEVEL[i - 1]))
      pass("上限严格递增，每一级都有新面孔");
    else fail("图鉴上限", "不是严格递增的");
    if (SPECIES_CEILING_BY_LEVEL.every((c) => c >= 151)) pass("任何等级的上限都 ≥151（传说档不会空）");
    else fail("上限下界", "有等级低于 151，传说档会是空的");
    expect("地区名对得上", [regionAt(151), regionAt(251), regionAt(386)], ["关都", "城都", "丰缘"]);

    // 每一档上限下四种稀有度都得有货，否则 createEncounters 会退回随机挑
    for (const cap of SPECIES_CEILING_BY_LEVEL) {
      const groups = await prisma.pokemonSpecies.groupBy({
        by: ["rarity"],
        where: { id: { lte: cap } },
        _count: true,
      });
      if (groups.length !== 4) {
        fail(`上限 ${cap} 的稀有度覆盖`, `只有 ${groups.length} 档有货`);
        break;
      }
    }
    pass("每一级的开放范围内四档稀有度都有货");

    // 等级一升，当天摇出来的遇怪就该能落在新范围里
    await prisma.child.update({ where: { id: child.id }, data: { level: MAX_LEVEL } });
    await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
    let sawBeyondKanto = false;
    for (let i = 0; i < 15 && !sawBeyondKanto; i++) {
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      await ensureTodayEncounters(child.id, `2099-01-${String((i % 28) + 1).padStart(2, "0")}`);
      const encs = await prisma.dailyEncounter.findMany({ where: { childId: child.id } });
      if (encs.some((e) => e.speciesId > REGIONS[0].ceiling)) sawBeyondKanto = true;
    }
    if (sawBeyondKanto) pass("满级后能遇到关都以外的宝可梦");
    else fail("高等级遇怪", "摇了 15 天还只出关都的");

    // ---------- 同一天不出重复种类 ----------
    //
    // **这个测试的场景是刻意挑的，别"简化"成一个全新号**：
    // 全新号上旧代码的单日撞车率只有 0.76%，跑 200 天也有 22% 的概率蒙混过关——
    // 那样的测试看着在跑，其实拦不住回归。
    //
    // 真正会撞的是中后期：稀有度先摇档、再在档内挑，而"偏向没抓到过的"
    // （UNSEEN_BIAS）会让档内候选随着收集进度不断缩小。所以这里先把
    // 每一档都刷到**只剩 1 只没抓到**，此时旧代码的单日撞车率约 11%，
    // 跑 120 天检出力 >99.99%。
    console.log("\n【图鉴】同一天不会遇到两只一样的");
    await prisma.child.update({ where: { id: child.id }, data: { level: 1 } });
    await prisma.caught.deleteMany({ where: { childId: child.id } });

    const kanto = await prisma.pokemonSpecies.findMany({
      where: { id: { lte: REGIONS[0].ceiling } },
    });
    const leaveUnseen = new Set(
      [1, 2, 3, 4].map((r) => kanto.find((sp) => sp.rarity === r)?.id).filter((id): id is number => !!id)
    );
    const anyBall = await prisma.ballType.findFirstOrThrow({ where: { childId: child.id } });
    await prisma.caught.createMany({
      data: kanto
        .filter((sp) => !leaveUnseen.has(sp.id))
        .map((sp) => ({
          childId: child.id,
          speciesId: sp.id,
          nameZh: sp.nameZh,
          types: sp.types,
          rarity: sp.rarity,
          artUrl: sp.artUrl,
          gender: "UNKNOWN" as const,
          ability: "自检",
          moveName: sp.moveName,
          movePower: sp.movePower,
          hp: sp.hp,
          attack: sp.attack,
          defense: sp.defense,
          speed: sp.speed,
          ballTypeId: anyBall.id,
          ballTier: anyBall.tier,
        })),
    });

    await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
    let dupDays = 0;
    for (let i = 0; i < 120; i++) {
      const day = `2098-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      await ensureTodayEncounters(child.id, day);
      const ids = (
        await prisma.dailyEncounter.findMany({
          where: { childId: child.id },
          select: { speciesId: true },
        })
      ).map((e) => e.speciesId);
      if (new Set(ids).size !== ids.length) dupDays += 1;
    }
    expect("120 天里出现重复的天数", dupDays, 0);

    // 刷新之后也不该再遇到今天刚抓到的那只。
    //
    // 同样**不能只跑一次**：随便抓一只、刷一次，旧代码重新摇到那一只的概率只有
    // 百分之一二，单次试验必过，等于没测。这里沿用上面"每档只剩 1 只没抓到"的局面，
    // 并且专挑那只没抓到的下手——它是所在档里唯一的 unseen，
    // 旧代码每个空位有约五成概率把它再摇出来，跑 25 天必然暴露。
    //
    // 刷新要花阳光（日薪 25 时第一次 5 点），先垫一笔够 25 次的。
    await prisma.pointsLedger.create({
      data: { childId: child.id, amount: 500, reason: "自检垫款", type: "MANUAL_ADJUST" },
    });
    let refreshDups = 0;
    for (let i = 0; i < 25; i++) {
      const day = `2097-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`;
      await prisma.dailyEncounter.deleteMany({ where: { childId: child.id } });
      await ensureTodayEncounters(child.id, day);

      const encs = await prisma.dailyEncounter.findMany({
        where: { childId: child.id },
        orderBy: { slot: "asc" },
      });
      // 优先挑那只"档内唯一没抓到过的"，它被重复摇出来的概率最高
      const target = encs.find((e) => leaveUnseen.has(e.speciesId)) ?? encs[0];
      await prisma.dailyEncounter.update({
        where: { id: target.id },
        data: { status: "CAUGHT" },
      });

      await refreshEncounters(child.id, day);
      const fresh2 = await prisma.dailyEncounter.findMany({
        where: { childId: child.id, date: dateStringToUtcDate(day), status: { not: "CAUGHT" } },
        select: { speciesId: true },
      });
      if (fresh2.some((e) => e.speciesId === target.speciesId)) refreshDups += 1;
    }
    expect("25 次刷新里又摇出已抓到那只的次数", refreshDups, 0);

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
