"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { approveDailyTask, rejectDailyTaskReview, revokeDailyTaskCompletion } from "@/lib/tasks";

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

/** 批准打卡：兼容"审核通过"和"家长直接补打卡"两种入口，逻辑都在 approveDailyTask 里。 */
export async function approveAction(taskId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await approveDailyTask(taskId, child.id);
  revalidateHistoryPaths();
}

/** 打回：只能作用于待审核状态的任务。 */
export async function rejectAction(taskId: string) {
  await requireParentSession();
  const child = await getPrimaryChild();
  await rejectDailyTaskReview(taskId, child.id);
  revalidateHistoryPaths();
}

