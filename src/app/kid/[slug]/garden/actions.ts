"use server";

import { revalidatePath } from "next/cache";

import { requireChildBySlug } from "@/lib/child";
import { harvestGarden, plantSeed } from "@/lib/garden";

export async function plantSeedAction(slug: string, plantTypeId: string) {
  const child = await requireChildBySlug(slug);

  await plantSeed(plantTypeId, child.id);
  revalidatePath(`/kid/${slug}/garden`);
  revalidatePath(`/kid/${slug}`);
}

export async function harvestGardenAction(slug: string) {
  const child = await requireChildBySlug(slug);

  await harvestGarden(child.id);
  revalidatePath(`/kid/${slug}/garden`);
  revalidatePath(`/kid/${slug}`);
}
