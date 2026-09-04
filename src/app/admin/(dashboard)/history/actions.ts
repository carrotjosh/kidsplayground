"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { completeDailyTask, revokeDailyTaskCompletion } from "@/lib/tasks";

function revalidateHistoryPaths() {
  revalidatePath("/admin/history");
  revalidatePath("/admin/points");
  revalidatePath("/admin");
}

export async function revokeAction(taskId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await revokeDailyTaskCompletion(taskId, child.id);
  revalidateHistoryPaths();
}

export async function markCompleteAction(taskId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await completeDailyTask(taskId, child.id);
  revalidateHistoryPaths();
}
