"use client";

import { useActionState } from "react";

import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form
        action={formAction}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-8 shadow"
      >
        <h1 className="text-xl font-bold text-slate-800">家长登录</h1>
        <input
          type="password"
          name="password"
          placeholder="请输入密码"
          required
          autoFocus
          className="rounded-lg border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-500"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-800 px-4 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}
