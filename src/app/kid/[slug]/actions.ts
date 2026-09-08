"use server";

import { revalidatePath } from "next/cache";

import { requireChildBySlug } from "@/lib/child";
import { redeemReward } from "@/lib/rewards";
import { submitDailyTaskForReview } from "@/lib/tasks";

export async function submitTaskAction(slug: string, taskId: string) {
  const child = await requireChildBySlug(slug);

  await submitDailyTaskForReview(taskId, child.id);
  revalidatePath(`/kid/${slug}`);
}

export async function redeemRewardAction(slug: string, rewardId: string) {
  const child = await requireChildBySlug(slug);

  await redeemReward(rewardId, child.id);
  revalidatePath(`/kid/${slug}/rewards`);
  revalidatePath(`/kid/${slug}`);
}
