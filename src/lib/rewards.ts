import { LedgerType, RedemptionStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { cooldownStateFrom, type CooldownState } from "@/lib/cooldown";
import { prisma } from "@/lib/db";

// 冷却相关的纯函数放在 lib/cooldown.ts（客户端组件也要用），这里转一手方便服务端调用
export { cooldownStateFrom, formatCooldown } from "@/lib/cooldown";
export type { CooldownState } from "@/lib/cooldown";

/**
 * 批量查一组礼物的冷却状态，给礼物橱窗渲染用。
 * 一次查询把所有礼物的最近一次兑换时间取回来，避免每个礼物查一次（数据库往返很贵）。
 */
export async function getCooldownStates(
  childId: string,
  rewards: { id: string; cooldownDays: number | null }[]
): Promise<Map<string, CooldownState>> {
  const limited = rewards.filter((r) => r.cooldownDays);
  if (limited.length === 0) return new Map();

  const grouped = await prisma.redemption.groupBy({
    by: ["rewardId"],
    where: { childId, rewardId: { in: limited.map((r) => r.id) } },
    _max: { createdAt: true },
  });
  const lastByReward = new Map(grouped.map((g) => [g.rewardId, g._max.createdAt]));

  return new Map(
    limited.map((r) => [
      r.id,
      cooldownStateFrom(r.cooldownDays, lastByReward.get(r.id) ?? null),
    ])
  );
}

/**
 * 孩子申请兑换礼物：事务内重新校验阳光够不够（防止并发重复点击透支），
 * 以及这个礼物是不是还在冷却期内（比如"去游乐场"每月只能换一次）。
 */
export async function redeemReward(rewardId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUnique({ where: { id: rewardId } });
    if (!reward || reward.childId !== childId || !reward.active) {
      throw new ActionError("礼物不存在");
    }

    if (reward.cooldownDays) {
      const last = await tx.redemption.findFirst({
        where: { childId, rewardId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      const state = cooldownStateFrom(reward.cooldownDays, last?.createdAt ?? null);
      if (!state.available) {
        throw new ActionError(`这个礼物还要等 ${state.daysLeft} 天才能再换哦`);
      }
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

/** 家长把某条兑换申请标记为"已线下兑现"，纯记账用途，不影响阳光（阳光在申请时已扣）。 */
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
