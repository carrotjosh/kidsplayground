import { redirect } from "next/navigation";

import { hasAnyUser } from "@/lib/users";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // 一个账号都还没有 → 先去建号，别让人对着登录页干瞪眼。
  if (!(await hasAnyUser())) redirect("/setup");

  return (
    <main className="pixel-sky-bg flex min-h-dvh items-center justify-center p-6">
      <LoginForm />
    </main>
  );
}
