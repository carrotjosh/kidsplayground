import { redirect } from "next/navigation";

import { hasAnyUser } from "@/lib/users";

import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // 已经有账号了就不能再建——注册入口只开放一次。
  if (await hasAnyUser()) redirect("/login");

  return (
    <main className="pixel-sky-bg flex min-h-dvh items-center justify-center p-6">
      <SetupForm />
    </main>
  );
}
