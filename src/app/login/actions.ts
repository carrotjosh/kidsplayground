"use server";

import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth";
import { authenticate } from "@/lib/users";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // 勾了"这是孩子的设备"就签发受限会话：同样是家长账号，但只能进孩子端，
  // 打不开 /admin，孩子没法自己批准自己的任务。
  const isKidDevice = formData.get("kidDevice") === "on";

  if (!email || !password) return "请填写邮箱和密码";

  const user = await authenticate(email, password);
  if (!user) return "邮箱或密码不对";

  await setSessionCookie({ userId: user.id, role: isKidDevice ? "kid" : "parent" });
  redirect(isKidDevice ? "/kid" : "/admin");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
