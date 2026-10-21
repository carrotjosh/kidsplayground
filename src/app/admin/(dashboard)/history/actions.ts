"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { ActionError } from "@/lib/errors";
import { excuseDay, unexcuseDay } from "@/lib/excused";
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


const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 标记请假（生病、出门）。这一天不跑宝可梦、不算进满勤分母、不打断连续达标。
 * 那天要是已经跑掉了一只，会一起接回来。见 lib/excused.ts。
 */
export async function excuseDayAction(
  date: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();
  if (!ISO_DATE.test(date)) return "日期不对";
  const child = await getPrimaryChild();
  try {
    const { restored } = await excuseDay(child.id, date, String(formData.get("reason") ?? ""));
    revalidateHistoryPaths();
    revalidatePath(`/kid/${child.slug}`, "layout");
    return restored.length > 0 ? `✅ 已请假，${restored.join("、")} 回来了` : "✅ 已请假";
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }
}

export async function unexcuseDayAction(date: string) {
  await requireParentSession();
  if (!ISO_DATE.test(date)) return;
  const child = await getPrimaryChild();
  await unexcuseDay(child.id, date);
  revalidateHistoryPaths();
  revalidatePath(`/kid/${child.slug}`, "layout");
}
