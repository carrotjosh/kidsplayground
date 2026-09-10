"use client";

import { useActionState } from "react";

import { setupAction } from "./actions";

export function SetupForm() {
  const [error, formAction, isPending] = useActionState(setupAction, null);

  return (
    <form
      action={formAction}
      className="pixel-card flex w-full max-w-sm flex-col gap-4 bg-white p-8"
    >
      <h1 className="pixel-text-outline text-center text-2xl font-bold text-nes-brown">
        🏰 创建家长账号
      </h1>
      <p className="text-sm text-slate-500">
        这是系统里的第一个账号。建好之后注册入口会自动关闭，别人打开只能看到登录页。
      </p>

      <input
        type="email"
        name="email"
        placeholder="邮箱（用来登录）"
        required
        autoFocus
        autoComplete="username"
        className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
      />
      <input
        type="password"
        name="password"
        placeholder="密码（至少 8 位）"
        required
        minLength={8}
        autoComplete="new-password"
        className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
      />
      <input
        type="password"
        name="confirm"
        placeholder="再输一次密码"
        required
        minLength={8}
        autoComplete="new-password"
        className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
      />

      {error && <p className="text-sm font-bold text-nes-red">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn bg-nes-red px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
      >
        {isPending ? "创建中..." : "创建账号"}
      </button>
    </form>
  );
}
