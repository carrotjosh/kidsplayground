import { LedgerType, RedemptionStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";

/** 孩子申请兑换礼物：事务内重新校验积分是否够用（防止并发重复点击透支），扣分并记一条兑换申请。 */
export async function redeemReward(rewardId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.childId !== childId || !reward.active) {
      throw new ActionError("礼物不存在");
    }

    const balanceResult = await tx.pointsLedger.aggregate({
      where: { childId },
      _sum: { amount: true },
    });
    const balance = balanceResult._sum.amount ?? 0;
    if (balance < reward.cost) {
      throw new ActionError("阳光还不够哦");
    }

    const redemption = await tx.redemption.create({
      data: {
        childId,
        rewardId: reward.id,
        rewardTitle: reward.title,
        cost: reward.cost,
        status: RedemptionStatus.REQUESTED,
      },
    });

    await tx.pointsLedger.create({
      data: {
        childId,
        amount: -reward.cost,
        reason: `兑换礼物：${reward.title}`,
        type: LedgerType.REDEMPTION,
        redemptionId: redemption.id,
      },
    });

    return redemption;
  });
}

/** 家长把某条兑换申请标记为"已线下兑现"，纯记账用途，不影响积分（积分在申请时已扣）。 */
export async function fulfillRedemption(redemptionId: string, childId: string) {
  const redemption = await prisma.redemption.findUnique({ where: { id: redemptionId } });
  if (!redemption || redemption.childId !== childId) {
    throw new ActionError("兑换记录不存在");
  }
  return prisma.redemption.update({
    where: { id: redemptionId },
    data: { status: RedemptionStatus.FULFILLED, fulfilledAt: new Date() },
  });
}
