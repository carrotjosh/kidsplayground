"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { dateStringToUtcDate, todayDateString } from "@/lib/date";
import { createAdhocTask } from "@/lib/tasks";
import { parseTaskFields } from "@/lib/taskName";

export async function createAdhocAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parseTaskFields(formData);
  if (!parsed.ok) return parsed.error;

  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const points = Number(formData.get("points"));
  const dateInput = String(formData.get("date") ?? "").trim();
  const dateString = dateInput || todayDateString();

  if (!Number.isFinite(points) || points <= 0) return "请填写大于 0 的奖励阳光";

  const child = await getPrimaryChild();
  await createAdhocTask({
    childId: child.id,
    date: dateStringToUtcDate(dateString),
    title: parsed.title,
    subject: parsed.subject,
    amount: parsed.amount,
    unit: parsed.unit,
    emoji,
    points,
  });

  revalidatePath("/admin/adhoc");
  revalidatePath("/admin/history");
  revalidatePath("/admin");
  return null;
}
