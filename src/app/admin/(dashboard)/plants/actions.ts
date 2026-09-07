"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

export async function createPlantTypeAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const cost = Number(formData.get("cost"));

  if (!title || !Number.isFinite(cost) || cost <= 0) {
    return "请填写植物名称和大于 0 的所需阳光";
  }

  const child = await getPrimaryChild();
  await prisma.plantType.create({ data: { childId: child.id, title, emoji, cost } });

  revalidatePath("/admin/plants");
  return null;
}

export async function togglePlantTypeActiveAction(plantTypeId: string, active: boolean) {
  await requireParentSession();
  await prisma.plantType.update({ where: { id: plantTypeId }, data: { active } });
  revalidatePath("/admin/plants");
}
