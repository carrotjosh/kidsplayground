"use client";

import { useActionState } from "react";

import { loginAction } from "./actions";

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form
      action={formAction}
      className="pixel-card flex w-full max-w-sm flex-col gap-4 bg-white p-8"
    >
      <h1 className="pixel-text-outline text-center text-2xl font-bold text-nes-brown">
        🏰 登录
      </h1>

      <input
        type="email"
        name="email"
        placeholder="邮箱"
        required
        autoFocus
        autoComplete="username"
        className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
      />
      <input
        type="password"
        name="password"
        placeholder="密码"
        required
        autoComplete="current-password"
        className="rounded-none border-2 border-nes-black px-4 py-3 text-lg outline-none"
      />

      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="kidDevice" className="mt-1" />
        <span>
          这是孩子的设备
          <br />
          <span className="text-xs text-slate-400">
            勾上后这台设备只能打开孩子端，进不了家长后台（防止孩子自己批准自己）。
            登录一次长期有效，可以「添加到主屏幕」当图标用。
          </span>
        </span>
      </label>

      {error && <p className="text-sm font-bold text-nes-red">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn bg-nes-red px-4 py-3 text-lg font-bold text-white disabled:opacity-50"
      >
        {isPending ? "登录中..." : "登录"}
      </button>
    </form>
  );
}
