import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { hasAnyUser } from "@/lib/users";

import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // 一个账号都还没有 → 先去建号，别让人对着登录页干瞪眼。
  if (!(await hasAnyUser())) redirect("/setup");

  // 带着"孩子设备"会话进来的，八成是家长误勾了那个框、现在被锁在孩子端出不去。
  // 明确告诉他发生了什么、怎么办，比让他对着一个普通登录页猜要好。
  const session = await getSession();
  const stuckAsKid = session?.role === "kid";

  return (
    <main className="pixel-sky-bg flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      {stuckAsKid && (
        <div className="pixel-card w-full max-w-sm bg-nes-yellow p-4 text-sm text-nes-black">
          这台设备现在是<b>孩子模式</b>，只能打开孩子端。
          <br />
          想回家长后台，在下面重新登录一次，<b>不要勾</b>「这是孩子的设备」。
        </div>
      )}
      <LoginForm />
    </main>
  );
}
