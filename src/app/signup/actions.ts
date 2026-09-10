"use server";

import { redirect } from "next/navigation";

import { setSessionCookie } from "@/lib/auth";
import { ActionError } from "@/lib/errors";
import { createInvitedUser } from "@/lib/users";

export async function signupAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();

  if (!email.includes("@")) return "请填写一个有效的邮箱";
  if (password.length < 8) return "密码至少 8 位";
  if (password !== confirm) return "两次输入的密码不一致";
  if (!inviteCode) return "请填写邀请码";

  let user;
  try {
    // 邀请码的校验在 createInvitedUser 里做（等长比较，防止用响应快慢逐字符试出来）
    user = await createInvitedUser(email, password, inviteCode);
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }

  await setSessionCookie({ userId: user.id, role: "parent" });
  // 新账号名下还没有孩子，直接送去建档，而不是落到一个到处报错的仪表盘。
  redirect("/admin/children");
}
