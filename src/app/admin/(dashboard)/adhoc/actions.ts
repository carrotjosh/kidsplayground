"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { dateStringToUtcDate, todayDateString } from "@/lib/date";
import { createAdhocTask } from "@/lib/tasks";

export async function createAdhocAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const title = String(formData.get("title") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim() || null;
  const points = Number(formData.get("points"));
  const dateInput = String(formData.get("date") ?? "").trim();
  const dateString = dateInput || todayDateString();

  if (!title || !Number.isFinite(points) || points <= 0) {
    return "请填写任务名称和大于 0 的分值";
  }

  const child = await getPrimaryChild();
  await createAdhocTask({
    childId: child.id,
    date: dateStringToUtcDate(dateString),
    title,
    emoji,
    points,
  });

  revalidatePath("/admin/adhoc");
  revalidatePath("/admin/history");
  revalidatePath("/admin");
  return null;
}
