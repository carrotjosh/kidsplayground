"use client";

import { useState } from "react";

import { createInviteCodeAction, revokeInviteCodeAction } from "./actions";

export type InviteRow = {
  id: string;
  code: string;
  createdAt: string;
  usedAt: string | null;
  usedByEmail: string | null;
};

/**
 * 邀请码列表 + 生成按钮。
 *
 * 做成客户端组件只为了"复制"这一个交互——点一下把码写进剪贴板并给个反馈，
 * 家长直接粘到微信发给朋友，不用手抄。
 */
export function InviteCodes({ codes }: { codes: InviteRow[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const unused = codes.filter((c) => !c.usedAt);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // 剪贴板 API 在非 HTTPS 下不可用，复制不了就算了，码本来就显示在屏幕上
      setCopied(null);
    }
  }

  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">邀请码</h2>
        <span className="text-sm text-slate-500">
          {unused.length > 0 ? `${unused.length} 个未使用` : "没有可用的码，注册已关闭"}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        一个码只能用一次。想邀请几个朋友就生成几个，发出去之前可以随时撤销。
        没有未使用的码时，注册页会自动关闭。
      </p>

      <form action={createInviteCodeAction}>
        <button type="submit" className="pixel-btn bg-nes-red px-4 py-2 text-white">
          ＋ 生成一个邀请码
        </button>
      </form>

      {codes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {codes.map((c) => (
            <li
              key={c.id}
              className={`flex flex-wrap items-center justify-between gap-2 border-2 p-2 ${
                c.usedAt ? "border-slate-200 bg-slate-50" : "border-nes-black bg-amber-50"
              }`}
            >
              <code
                className={`text-base font-bold tracking-wider ${
                  c.usedAt ? "text-slate-400 line-through" : "text-slate-800"
                }`}
              >
                {c.code}
              </code>
              <span className="text-xs text-slate-500">
                {c.usedAt ? `已被 ${c.usedByEmail ?? "某账号"} 使用` : `生成于 ${c.createdAt}`}
              </span>
              {!c.usedAt && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {copied === c.code ? "已复制 ✓" : "复制"}
                  </button>
                  <form action={revokeInviteCodeAction.bind(null, c.id)}>
                    <button
                      type="submit"
                      className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
                    >
                      撤销
                    </button>
                  </form>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
