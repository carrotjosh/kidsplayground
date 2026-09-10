import { redirect } from "next/navigation";

import { hasAnyUser, isSignupOpen } from "@/lib/users";

import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  // 一个用户都没有 → 走"第一个账号"的引导（那个账号会拿到超管权限，且不需要邀请码）
  if (!(await hasAnyUser())) redirect("/setup");
  // 没有未使用的邀请码 = 注册关闭。默认关闭是刻意的：不会因为忘了配置就对全网开放。
  if (!(await isSignupOpen())) redirect("/login");

  return (
    <main className="pixel-sky-bg flex min-h-dvh items-center justify-center p-6">
      <SignupForm />
    </main>
  );
}
