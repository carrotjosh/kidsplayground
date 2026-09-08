"use server";

import { redirect } from "next/navigation";

import { setSessionCookie } from "@/lib/auth";
import { ActionError } from "@/lib/errors";
import { createFirstUser } from "@/lib/users";

export async function setupAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!email.includes("@")) return "请填写一个有效的邮箱";
  if (password.length < 8) return "密码至少 8 位";
  if (password !== confirm) return "两次输入的密码不一致";

  let user;
  try {
    user = await createFirstUser(email, password);
  } catch (error) {
    if (error instanceof ActionError) return error.message;
    throw error;
  }

  await setSessionCookie({ userId: user.id, role: "parent" });
  redirect("/admin");
}
