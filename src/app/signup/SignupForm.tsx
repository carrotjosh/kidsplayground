"use client";

import { useActionState } from "react";

import { signupAction } from "./actions";

const inputClass = "rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none";

export function SignupForm() {
  const [error, formAction, isPending] = useActionState(signupAction, null);

  return (
    <form action={formAction} className="pixel-card flex w-full max-w-sm flex-col gap-4 bg-white p-8">
      <h1 className="pixel-text-outline text-center text-2xl font-bold text-nes-brown">
        🏰 注册家长账号
      </h1>
      <p className="text-sm text-slate-500">
        需要邀请码。注册后你会有一个完全独立的空间，孩子、任务、阳光都只有你自己看得到。
      </p>

      <input
        name="inviteCode"
        placeholder="邀请码"
        required
        autoFocus
        autoComplete="off"
        className={inputClass}
      />
      <input
        type="email"
        name="email"
        placeholder="邮箱（用来登录）"
        required
        autoComplete="username"
        className={inputClass}
      />
      <input
        type="password"
        name="password"
        placeholder="密码（至少 8 位）"
        required
        minLength={8}
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        type="password"
        name="confirm"
        placeholder="再输一次密码"
        required
        minLength={8}
        autoComplete="new-password"
        className={inputClass}
      />

      {error && <p className="text-sm font-bold text-nes-red">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn bg-nes-red px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
      >
        {isPending ? "创建中..." : "创建账号"}
      </button>

      <a href="/login" className="text-center text-sm text-slate-500 underline">
        已经有账号了？去登录
      </a>
    </form>
  );
}
