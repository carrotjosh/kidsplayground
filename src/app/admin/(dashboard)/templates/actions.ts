"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

function parseWeekdays(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
}

export async function createTemplateAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const points = Number(formData.get("points"));
  const weekdays = parseWeekdays(formData);

  if (!title || !Number.isFinite(points) || points <= 0 || weekdays.length === 0) {
    return "请填写任务名称、大于 0 的分值，并至少选一个生效星期";
  }

  const child = await getPrimaryChild();
  await prisma.taskTemplate.create({
    data: { childId: child.id, title, emoji, points, weekdays },
  });

  revalidatePath("/admin/templates");
  return null;
}

export async function toggleTemplateActiveAction(templateId: string, active: boolean) {
  await requireParentSession();
  await prisma.taskTemplate.update({ where: { id: templateId }, data: { active } });
  revalidatePath("/admin/templates");
}
