/**
 * 跨租户隔离自检。
 *
 * 用法：npm run check:isolation
 *
 * 建两个临时租户 A / B，然后拿 A 的 childId 去操作 B 的资源，逐个断言必须失败。
 * 这是多租户改造里唯一真正要紧的东西——串户是这次改动的主要风险，改完必须能证明没串。
 * 跑完会把两个临时租户连同数据一起删掉。
 *
 * 覆盖的是 lib 层（所有拿"客户端传来的 id"做的操作都在这一层校验归属）。
 * Cookie 伪造那条路径需要 HTTP 请求上下文，脚本里造不出来，靠 curl 双 Cookie 实测覆盖。
 */
import "dotenv/config";

import { hashPassword } from "../src/lib/auth";
import { seedDefaultsForChild } from "../src/lib/bootstrap";
import { prisma } from "../src/lib/db";
import { excuseDay, unexcuseDay } from "../src/lib/excused";
import { purgeTestTenants } from "../src/lib/testTenant";
import { todayAsUtcDate, todayDateString } from "../src/lib/date";
import { ensureTodayEncounters, throwBall } from "../src/lib/pokedex";
import { fulfillRedemption, redeemReward } from "../src/lib/rewards";
import { adjustPointsManually } from "../src/lib/points";
import {
  approveAllPendingReviews,
  approveDailyTask,
  createAdhocTask,
  revokeDailyTaskCompletion,
} from "../src/lib/tasks";

const MARK = "[isolation-test]";
let failures = 0;

function pass(what: string) {
  console.log(`  ✅ ${what}`);
}
function fail(what: string, detail: string) {
  console.log(`  ❌ ${what} —— ${detail}`);
  failures += 1;
}

/** 断言这个操作会被拒绝。成功返回 = 越权成功 = 测试失败。 */
async function mustReject(what: string, run: () => Promise<unknown>) {
  try {
    await run();
    fail(what, "居然成功了，说明能操作别人家的数据");
  } catch {
    pass(what);
  }
}

async function createTenant(tag: string) {
  const user = await prisma.user.create({
    data: {
      email: `${MARK}-${tag}-${Date.now()}@example.invalid`,
      passwordHash: await hashPassword("test-password-123"),
    },
  });
  const child = await prisma.child.create({
    data: { name: `${MARK}${tag}`, slug: `iso-${tag}-${Date.now()}`, userId: user.id },
  });
  await seedDefaultsForChild(child.id);

  const task = await createAdhocTask({
    childId: child.id,
    date: todayAsUtcDate(),
    title: "隔离测试任务",
    subject: "测试",
    amount: 1,
    unit: "次",
    emoji: "🧪",
    points: 10,
  });
  const reward = (await prisma.reward.findFirst({ where: { childId: child.id } }))!;

  const ballType = (await prisma.ballType.findFirst({ where: { childId: child.id } }))!;
  await ensureTodayEncounters(child.id, todayDateString());
  const encounter = (await prisma.dailyEncounter.findFirst({ where: { childId: child.id } }))!;

  // 给点余额，否则"兑换失败"可能是因为阳光不够而不是因为归属校验，测试就失去意义了
  await adjustPointsManually(child.id, 1000, "隔离测试初始余额");
  const redemption = await redeemReward(reward.id, child.id);

  return { user, child, task, reward, ballType, encounter, redemption };
}

async function main() {
  // 同 check-economy：上次跑崩会把临时租户留在库里，开跑前先扫一遍
  const swept = await purgeTestTenants(MARK);
  if (swept > 0) console.log(`清理了 ${swept} 个上次残留的临时租户。`);

  console.log("建两个临时租户...");
  const A = await createTenant("A");
  const B = await createTenant("B");
  console.log(`  A: ${A.child.name} (${A.child.id})\n  B: ${B.child.name} (${B.child.id})\n`);

  console.log("A 拿自己的 childId 去操作 B 的资源，全部必须被拒：");
  await mustReject("批准 B 的任务", () => approveDailyTask(B.task.id, A.child.id));
  await mustReject("撤销 B 的任务", () => revokeDailyTaskCompletion(B.task.id, A.child.id));
  await mustReject("兑换 B 的礼物", () => redeemReward(B.reward.id, A.child.id));
  await mustReject("核销 B 的兑换单", () => fulfillRedemption(B.redemption.id, A.child.id));
  await mustReject("用 B 的精灵球扔", () => throwBall(A.encounter.id, B.ballType.id, A.child.id));
  await mustReject("扔 B 遇到的宝可梦", () => throwBall(B.encounter.id, A.ballType.id, A.child.id));

  console.log("\n反向再来一遍（防止只有单向做了校验）：");
  await mustReject("B 批准 A 的任务", () => approveDailyTask(A.task.id, B.child.id));
  await mustReject("B 兑换 A 的礼物", () => redeemReward(A.reward.id, B.child.id));
  await mustReject("B 用 A 的精灵球扔", () => throwBall(B.encounter.id, A.ballType.id, B.child.id));

  console.log("\n各自操作自己的资源应该正常：");
  try {
    await approveDailyTask(A.task.id, A.child.id);
    pass("A 批准自己的任务");
  } catch (e) {
    fail("A 批准自己的任务", (e as Error).message);
  }

  console.log("\nB 的数据没有被 A 的越权尝试改动：");
  const bTask = await prisma.dailyTask.findUnique({ where: { id: B.task.id } });
  if (bTask?.status === "PENDING") pass("B 的任务仍然是 PENDING");
  else fail("B 的任务状态", `被改成了 ${bTask?.status}`);

  // 一键审批：这个操作不带任务 id（就是「把我家孩子的待审核全批了」），
  // 所以挡不住的话不是越权调用，而是 where 漏了 childId —— A 点一下会把 B 的也批掉。
  // B 的任务此时是 PENDING_REVIEW，A 批完之后它必须还在。
  // A 自己也造一条待审核，这样「批到 1 条 + B 没被碰」同时成立——
  // 不然 A 名下 0 条待审核时，一个什么都不做的实现也能让这条断言通过。
  await prisma.dailyTask.update({ where: { id: B.task.id }, data: { status: "PENDING_REVIEW" } });
  const aOwn = await createAdhocTask({
    childId: A.child.id, date: todayAsUtcDate(), title: "A 的待审核", points: 3,
  });
  await prisma.dailyTask.update({ where: { id: aOwn.id }, data: { status: "PENDING_REVIEW" } });

  const batch = await approveAllPendingReviews(A.child.id);
  const bAfter = await prisma.dailyTask.findUniqueOrThrow({ where: { id: B.task.id } });
  if (batch.count === 1 && bAfter.status === "PENDING_REVIEW") {
    pass("A 一键审批批到自己那 1 条，没碰 B 的");
  } else {
    fail("一键审批的范围", `批了 ${batch.count} 条，B 的任务现在是 ${bAfter.status}`);
  }
  await prisma.dailyTask.update({ where: { id: B.task.id }, data: { status: "PENDING" } });

  // 请假日：A 的孩子请假，不能让 B 的孩子也算请假；B 撤销同一天也撤不掉 A 的。
  // lib 函数按 childId 写入/删除，这里确认按孩子隔离而不是按日期。
  const sickDay = "2099-01-15";
  await excuseDay(A.child.id, sickDay, "发烧");
  await unexcuseDay(B.child.id, sickDay);
  const aExcused = await prisma.excusedDay.count({ where: { childId: A.child.id } });
  const bExcused = await prisma.excusedDay.count({ where: { childId: B.child.id } });
  if (aExcused === 1 && bExcused === 0) pass("A 的请假不会出现在 B 名下，B 也撤不掉");
  else fail("请假日隔离", `A=${aExcused} 条，B=${bExcused} 条`);

  // 清理：先删两个孩子名下的全部数据，再删账号
  for (const t of [A, B]) {
    await prisma.$transaction([
      prisma.pointsLedger.deleteMany({ where: { childId: t.child.id } }),
      prisma.caught.deleteMany({ where: { childId: t.child.id } }),
      prisma.dailyEncounter.deleteMany({ where: { childId: t.child.id } }),
      prisma.ballType.deleteMany({ where: { childId: t.child.id } }),
      prisma.redemption.deleteMany({ where: { childId: t.child.id } }),
      prisma.excusedDay.deleteMany({ where: { childId: t.child.id } }),
      prisma.dailyTask.deleteMany({ where: { childId: t.child.id } }),
      prisma.reward.deleteMany({ where: { childId: t.child.id } }),
      prisma.taskTemplate.deleteMany({ where: { childId: t.child.id } }),
      prisma.child.delete({ where: { id: t.child.id } }),
      prisma.user.delete({ where: { id: t.user.id } }),
    ]);
  }
  console.log("\n临时租户已清理。");

  if (failures > 0) {
    console.log(`\n❌ ${failures} 项隔离检查未通过`);
    process.exit(1);
  }
  console.log("\n✅ 全部隔离检查通过");
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
