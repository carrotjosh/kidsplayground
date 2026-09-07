"use server";

import { revalidatePath } from "next/cache";

import { getChildBySlug } from "@/lib/child";
import { ActionError } from "@/lib/errors";
import { redeemReward } from "@/lib/rewards";
import { submitDailyTaskForReview } from "@/lib/tasks";

export async function submitTaskAction(slug: string, taskId: string) {
  const child = await getChildBySlug(slug);
  if (!child) throw new ActionError("找不到这个孩子");

  await submitDailyTaskForReview(taskId, child.id);
  revalidatePath(`/kid/${slug}`);
}

export async function redeemRewardAction(slug: string, rewardId: string) {
  const child = await getChildBySlug(slug);
  if (!child) throw new ActionError("找不到这个孩子");

  await redeemReward(rewardId, child.id);
  revalidatePath(`/kid/${slug}/rewards`);
  revalidatePath(`/kid/${slug}`);
}
