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
import { todayAsUtcDate } from "../src/lib/date";
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

    // 直接调 lib 层做校准（action 需要会话上下文，脚本里造不出来）
    const rate = await dailyEarnRate(child.id);
    const factor = rate / child.priceBaselineRate;
    const scale = (n: number) => Math.max(1, Math.round(n * factor));
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
        data: { dailyGoalPoints: scale(20), priceBaselineRate: rate },
      }),
    ]);

    const toyAfter = await prisma.reward.findUniqueOrThrow({ where: { id: toyBefore.id } });
    expect("校准后「一个小玩具」", toyAfter.cost, 760);
    const after = await auditEconomy(child.id);
    expect("校准后漂移倍数", after.drift, 1);
    if ((await recalibrationPreview(child.id)).rows.length === 0) pass("再校准一次没有任何变动（幂等）");
    else fail("校准幂等", "第二次仍然想改价");
    if (!after.findings.some((f) => f.title.includes("日薪从"))) pass("校准后不再提示漂移");
    else fail("校准后", "还在提示漂移");

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
    await destroyTenant(child.id, user.id);
    console.log("\n临时租户已清理。");
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
