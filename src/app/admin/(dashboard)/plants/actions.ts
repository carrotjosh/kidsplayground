"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { PlantStatus } from "@/generated/prisma/client";

function revalidatePlantPaths() {
  revalidatePath("/admin/plants");
  revalidatePath("/admin");
}

type ParsedPlantType =
  | { ok: true; title: string; cost: number; emoji: string | null }
  | { ok: false; error: string };

function parsePlantType(formData: FormData): ParsedPlantType {
  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const cost = Number(formData.get("cost"));

  if (!title) return { ok: false, error: "请填写植物名称" };
  if (!Number.isFinite(cost) || cost <= 0) return { ok: false, error: "请填写大于 0 的所需阳光" };

  return { ok: true, title, cost, emoji };
}

export async function createPlantTypeAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parsePlantType(formData);
  if (!parsed.ok) return parsed.error;

  const child = await getPrimaryChild();
  await prisma.plantType.create({
    data: { childId: child.id, title: parsed.title, emoji: parsed.emoji, cost: parsed.cost },
  });

  revalidatePlantPaths();
  return null;
}

export async function updatePlantTypeAction(
  plantTypeId: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parsePlantType(formData);
  if (!parsed.ok) return parsed.error;

  const child = await getPrimaryChild();
  // 用 updateMany 带上 childId 条件，顺便挡住改别人家植物的越权请求
  const result = await prisma.plantType.updateMany({
    where: { id: plantTypeId, childId: child.id },
    data: { title: parsed.title, emoji: parsed.emoji, cost: parsed.cost },
  });
  if (result.count === 0) return "植物不存在";

  revalidatePlantPaths();
  return null;
}

export async function togglePlantTypeActiveAction(plantTypeId: string, active: boolean) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await prisma.plantType.updateMany({
    where: { id: plantTypeId, childId: child.id },
    data: { active },
  });
  revalidatePlantPaths();
}

/**
 * 删除植物品种。历史植物记录不会被删——Plant.plantTypeId 的外键是 ON DELETE SET NULL，
 * 记录里的名称和图案都有快照，只是断开和目录的关联。
 *
 * 但花园里还活着的这种植物会挡住删除：删了之后它们变成"无主"植物，继续占着格子却不再
 * 算进集卡目标，孩子就永远集不齐一整套了。这种情况让家长改用「下架」。
 */
export async function deletePlantTypeAction(plantTypeId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();

  const aliveCount = await prisma.plant.count({
    where: { childId: child.id, plantTypeId, status: PlantStatus.ALIVE },
  });
  if (aliveCount > 0) return;

  await prisma.plantType.deleteMany({ where: { id: plantTypeId, childId: child.id } });
  revalidatePlantPaths();
}
