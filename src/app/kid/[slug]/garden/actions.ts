"use server";

import { revalidatePath } from "next/cache";

import { getChildBySlug } from "@/lib/child";
import { ActionError } from "@/lib/errors";
import { plantSeed } from "@/lib/garden";

export async function plantSeedAction(slug: string, plantTypeId: string) {
  const child = await getChildBySlug(slug);
  if (!child) throw new ActionError("找不到这个孩子");

  await plantSeed(plantTypeId, child.id);
  revalidatePath(`/kid/${slug}/garden`);
  revalidatePath(`/kid/${slug}`);
}
