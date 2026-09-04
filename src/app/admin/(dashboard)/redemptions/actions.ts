"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { fulfillRedemption } from "@/lib/rewards";

export async function fulfillAction(redemptionId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await fulfillRedemption(redemptionId, child.id);
  revalidatePath("/admin/redemptions");
  revalidatePath("/admin");
}
