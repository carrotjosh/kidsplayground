"use server";

import { revalidatePath } from "next/cache";

import { KidTheme } from "@/generated/prisma/client";
import { requireParentSession } from "@/lib/auth";
import { setDailyGoalPoints } from "@/lib/calendar";
import {
  createChildForCurrentUser,
  deleteChild,
  effectiveUserId,
  getActiveChild,
  renameChild,
  setActiveChild,
} from "@/lib/child";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/errors";

/** 切孩子会改变后台每一页的内容，所以整个 /admin 都要失效重取。 */
function revalidateEverything() {
  revalidatePath("/admin", "layout");
}

export async function createChildAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  // 表单来的值不可信，只认枚举里真实存在的那两个；认不出来就退回默认主题，
  // 不要因为有人改了 radio 的 value 就让建档失败。
  const raw = String(formData.get("theme") ?? "");
  const theme = raw in KidTheme ? (raw as KidTheme) : KidTheme.GARDEN;

  try {
    await createChildForCurrentUser(String(formData.get("name") ?? ""), theme);
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }

  revalidateEverything();
  return null;
}

export async function renameChildAction(
  childId: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  try {
    await renameChild(childId, String(formData.get("name") ?? ""));
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }

  revalidateEverything();
  return null;
}

export async function switchChildAction(childId: string) {
  await requireParentSession();
  await setActiveChild(childId);
  revalidateEverything();
}

export async function deleteChildAction(childId: string) {
  await requireParentSession();
  await deleteChild(childId);
  revalidateEverything();
}

export async function setThemeAction(theme: KidTheme) {
  const session = await requireParentSession();
  const child = await getActiveChild();
  // 带 childId + userId 双条件，挡住越权改别人家孩子的主题
  await prisma.child.updateMany({
    where: { id: child.id, userId: effectiveUserId(session) },
    data: { theme },
  });
  revalidateEverything();
}

export async function setDailyGoalAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const points = Number(formData.get("points"));
  const child = await getActiveChild();
  try {
    await setDailyGoalPoints(child.id, points);
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }

  revalidateEverything();
  return null;
}
