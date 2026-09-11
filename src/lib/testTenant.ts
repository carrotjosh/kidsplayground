import { prisma } from "@/lib/db";

/**
 * 自检脚本用的临时租户清理。
 *
 * 为什么要单独抽出来：check-economy 有一次跑到清理那一步时 Neon 连接抖了一下，
 * 临时租户就永久留在了生产库里（还带着 121 条 Caught 记录）。
 * finally 里的清理**本身也可能失败**，所以光有 finally 不够，
 * 每次开跑前还得先扫一遍上次的残骸。
 *
 * 只按 email 后缀 `@example.invalid` + 脚本自己的 MARK 前缀定位，
 * 绝不做"删掉所有测试样子的数据"这种模糊匹配——这是生产库。
 */
export async function purgeTestTenants(mark: string): Promise<number> {
  const stale = await prisma.user.findMany({
    where: { email: { startsWith: mark, endsWith: "@example.invalid" } },
    include: { children: { select: { id: true } } },
  });

  for (const user of stale) {
    for (const child of user.children) {
      await prisma.$transaction([
        prisma.pointsLedger.deleteMany({ where: { childId: child.id } }),
        prisma.caught.deleteMany({ where: { childId: child.id } }),
        prisma.dailyEncounter.deleteMany({ where: { childId: child.id } }),
        prisma.ballType.deleteMany({ where: { childId: child.id } }),
        prisma.redemption.deleteMany({ where: { childId: child.id } }),
        prisma.plant.deleteMany({ where: { childId: child.id } }),
        prisma.dailyTask.deleteMany({ where: { childId: child.id } }),
        prisma.reward.deleteMany({ where: { childId: child.id } }),
        prisma.plantType.deleteMany({ where: { childId: child.id } }),
        prisma.taskTemplate.deleteMany({ where: { childId: child.id } }),
        prisma.child.delete({ where: { id: child.id } }),
      ]);
    }
    await prisma.inviteCode.deleteMany({ where: { createdById: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  return stale.length;
}
