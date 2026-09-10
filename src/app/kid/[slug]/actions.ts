"use server";

import { revalidatePath } from "next/cache";

import { TaskStatus } from "@/generated/prisma/client";
import { requireChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { notifyParent } from "@/lib/notify";
import { redeemReward } from "@/lib/rewards";
import { submitDailyTaskForReview } from "@/lib/tasks";

/**
 * 通知放在 action 层而不是 lib 层：这里才是"孩子做了一件需要家长处理的事"这个语义所在，
 * lib 里的同名函数家长端补打卡也会调，不该触发通知。
 * notifyParent 自己吞掉所有异常，所以 await 它不会让孩子的操作失败。
 */
export async function submitTaskAction(slug: string, taskId: string) {
  const child = await requireChildBySlug(slug);

  const task = await submitDailyTaskForReview(taskId, child.id);

  // 顺带数一下总共积压了多少，家长看一眼消息就知道要不要现在处理
  const pending = await prisma.dailyTask.count({
    where: { childId: child.id, status: TaskStatus.PENDING_REVIEW },
  });
  await notifyParent(
    child.id,
    `${child.name} 提交了打卡`,
    `${task.emoji ?? "⭐"} ${task.title}（${task.points} 阳光）\n当前共 ${pending} 项待审核`
  );

  revalidatePath(`/kid/${slug}`);
}

export async function redeemRewardAction(slug: string, rewardId: string) {
  const child = await requireChildBySlug(slug);

  const redemption = await redeemReward(rewardId, child.id);

  await notifyParent(
    child.id,
    `${child.name} 想兑换礼物`,
    `🎁 ${redemption.rewardTitle}（花了 ${redemption.cost} 阳光）\n记得线下兑现，然后去后台标记已发放`
  );

  revalidatePath(`/kid/${slug}/rewards`);
  revalidatePath(`/kid/${slug}`);
}
