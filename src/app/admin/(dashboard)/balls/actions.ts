"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

/**
 * 精灵球目录只允许改**价格**和上下架，不允许增删品种、也不允许改 catchPower。
 * 四个等级和它们的抓取倍率是玩法平衡的一部分（模拟过 20 万次才调出来的曲线），
 * 让家长随手改会直接把经济玩坏；但价格是该由家长按自家阳光产出来调的。
 */
function revalidateBallPaths() {
  revalidatePath("/admin/balls");
  revalidatePath("/admin");
}

export async function updateBallCostAction(
  ballTypeId: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const cost = Number(formData.get("cost"));
  if (!Number.isFinite(cost) || cost <= 0) return "请填写大于 0 的阳光价格";

  const child = await getPrimaryChild();
  const result = await prisma.ballType.updateMany({
    where: { id: ballTypeId, childId: child.id },
    data: { cost },
  });
  if (result.count === 0) return "找不到这种精灵球";

  revalidateBallPaths();
  return null;
}

export async function toggleBallActiveAction(ballTypeId: string, active: boolean) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await prisma.ballType.updateMany({
    where: { id: ballTypeId, childId: child.id },
    data: { active },
  });
  revalidateBallPaths();
}
