"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

export async function createRewardAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const cost = Number(formData.get("cost"));

  if (!title || !Number.isFinite(cost) || cost <= 0) {
    return "请填写礼物名称和大于 0 的所需积分";
  }

  const child = await getPrimaryChild();
  await prisma.reward.create({ data: { childId: child.id, title, emoji, cost } });

  revalidatePath("/admin/rewards");
  return null;
}

export async function toggleRewardActiveAction(rewardId: string, active: boolean) {
  await requireParentSession();
  await prisma.reward.update({ where: { id: rewardId }, data: { active } });
  revalidatePath("/admin/rewards");
}
