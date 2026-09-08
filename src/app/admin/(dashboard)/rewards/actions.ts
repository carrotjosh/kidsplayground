"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

function revalidateRewardPaths() {
  revalidatePath("/admin/rewards");
  revalidatePath("/admin/redemptions");
  revalidatePath("/admin");
}

type ParsedReward =
  | { ok: true; title: string; cost: number; emoji: string | null; cooldownDays: number | null }
  | { ok: false; error: string };

function parseReward(formData: FormData): ParsedReward {
  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const cost = Number(formData.get("cost"));

  if (!title) return { ok: false, error: "请填写礼物名称" };
  if (!Number.isFinite(cost) || cost <= 0) return { ok: false, error: "请填写大于 0 的所需阳光" };

  const cooldownRaw = String(formData.get("cooldownDays") ?? "").trim();
  let cooldownDays: number | null = null;
  if (cooldownRaw) {
    const parsed = Number(cooldownRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "兑换间隔天数要是一个大于 0 的整数" };
    }
    cooldownDays = parsed;
  }

  return { ok: true, title, cost, emoji, cooldownDays };
}

export async function createRewardAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parseReward(formData);
  if (!parsed.ok) return parsed.error;

  const child = await getPrimaryChild();
  await prisma.reward.create({
    data: {
      childId: child.id,
      title: parsed.title,
      emoji: parsed.emoji,
      cost: parsed.cost,
      cooldownDays: parsed.cooldownDays,
    },
  });

  revalidateRewardPaths();
  return null;
}

export async function updateRewardAction(
  rewardId: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parseReward(formData);
  if (!parsed.ok) return parsed.error;

  const child = await getPrimaryChild();
  // 用 updateMany 带上 childId 条件，顺便挡住改别人家礼物的越权请求
  const result = await prisma.reward.updateMany({
    where: { id: rewardId, childId: child.id },
    data: {
      title: parsed.title,
      emoji: parsed.emoji,
      cost: parsed.cost,
      cooldownDays: parsed.cooldownDays,
    },
  });
  if (result.count === 0) return "礼物不存在";

  revalidateRewardPaths();
  return null;
}

export async function toggleRewardActiveAction(rewardId: string, active: boolean) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await prisma.reward.updateMany({ where: { id: rewardId, childId: child.id }, data: { active } });
  revalidateRewardPaths();
}

/**
 * 删除礼物。已有的兑换记录不会被删——Redemption.rewardId 的外键是 ON DELETE SET NULL，
 * 记录里的名称和价格都有快照，只是断开和礼物的关联。
 */
export async function deleteRewardAction(rewardId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await prisma.reward.deleteMany({ where: { id: rewardId, childId: child.id } });
  revalidateRewardPaths();
}
