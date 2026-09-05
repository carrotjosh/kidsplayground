"use client";

import { useActionState } from "react";

import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <main className="pixel-sky-bg flex min-h-screen items-center justify-center p-6">
      <form
        action={formAction}
        className="pixel-card flex w-full max-w-sm flex-col gap-4 bg-white p-8"
      >
        <h1 className="pixel-text-outline text-center text-2xl font-bold text-nes-brown">
          🏰 家长登录
        </h1>
        <input
          type="password"
          name="password"
          placeholder="请输入密码"
          required
          autoFocus
          className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
        />
        {error && <p className="text-sm font-bold text-nes-red">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="pixel-btn bg-nes-red px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
        >
          {isPending ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}
