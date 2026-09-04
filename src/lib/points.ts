import { LedgerType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** 孩子的当前积分余额 = 该孩子所有积分流水求和，不单独存余额字段，避免和流水对不上。 */
export async function getPointsBalance(childId: string): Promise<number> {
  const result = await prisma.pointsLedger.aggregate({
    where: { childId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/** 家长手动加/减分，用于走不进任务系统的情况（比如额外奖励、犯错扣分）。 */
export async function adjustPointsManually(childId: string, amount: number, reason: string) {
  return prisma.pointsLedger.create({
    data: { childId, amount, reason, type: LedgerType.MANUAL_ADJUST },
  });
}
