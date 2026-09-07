"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { adjustPointsManually } from "@/lib/points";

export async function adjustPointsAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!Number.isFinite(amount) || amount === 0 || !reason) {
    return "请填写不为 0 的阳光值和原因";
  }

  const child = await getPrimaryChild();
  await adjustPointsManually(child.id, amount, reason);

  revalidatePath("/admin/points");
  revalidatePath("/admin");
  return null;
}
