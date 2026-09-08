"use server";

import { revalidatePath } from "next/cache";

import { ScheduleType } from "@/generated/prisma/client";
import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { parseTaskFields } from "@/lib/taskName";

function parseWeekdays(formData: FormData): number[] {
  return formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
}

function parseScheduleType(formData: FormData): ScheduleType {
  const raw = String(formData.get("scheduleType") ?? "");
  return raw === "WORKDAY" || raw === "HOLIDAY" ? raw : ScheduleType.WEEKDAYS;
}

export async function createTemplateAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parseTaskFields(formData);
  if (!parsed.ok) return parsed.error;

  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const points = Number(formData.get("points"));
  const scheduleType = parseScheduleType(formData);
  // 只有"按星期几"这种模式才需要 weekdays；跟着法定日历走的模式存空数组。
  const weekdays = scheduleType === ScheduleType.WEEKDAYS ? parseWeekdays(formData) : [];

  if (!Number.isFinite(points) || points <= 0) return "请填写大于 0 的奖励阳光";
  if (scheduleType === ScheduleType.WEEKDAYS && weekdays.length === 0) {
    return "请至少选一个生效星期";
  }

  const child = await getPrimaryChild();
  await prisma.taskTemplate.create({
    data: {
      childId: child.id,
      title: parsed.title,
      subject: parsed.subject,
      amount: parsed.amount,
      unit: parsed.unit,
      emoji,
      points,
      scheduleType,
      weekdays,
    },
  });

  revalidatePath("/admin/templates");
  return null;
}

export async function toggleTemplateActiveAction(templateId: string, active: boolean) {
  await requireParentSession();
  await prisma.taskTemplate.update({ where: { id: templateId }, data: { active } });
  revalidatePath("/admin/templates");
}

/**
 * 删除任务模板。已经生成过的历史任务不会被删掉——DailyTask.templateId 的外键是
 * ON DELETE SET NULL，历史记录里的标题、分值都有快照，只是断开和模板的关联。
 */
export async function deleteTemplateAction(templateId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await prisma.taskTemplate.deleteMany({ where: { id: templateId, childId: child.id } });
  revalidatePath("/admin/templates");
  revalidatePath("/admin/history");
  revalidatePath("/admin");
}
