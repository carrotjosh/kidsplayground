"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { inviteMessage } from "@/lib/inviteMessage";

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
 * 核心交互是**点一下生成，整段邀请语直接进剪贴板**——码、注册链接、
 * 三步说明一次性给全，粘到微信就能发。一次一次地贴码、贴链接、再口头解释一遍，
 * 摩擦全在那儿，邀请三个朋友就懒得邀了。
 *
 * 剪贴板写入必须紧跟着点击：所以生成走 onClick 里 await server action、
 * 拿到码马上写，而不是 <form action>（那样拿不到返回值，
 * 而且 revalidate 之后手势窗口早过了，Safari 会直接拒绝）。
 */
export function InviteCodes({ codes }: { codes: InviteRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** 刚复制成功的那条码，用来给按钮一个"已复制 ✓"的反馈 */
  const [copied, setCopied] = useState<string | null>(null);
  /** 剪贴板不可用时退回手工复制：把整段话摊在文本框里让家长自己选 */
  const [fallback, setFallback] = useState<string | null>(null);

  const unused = codes.filter((c) => !c.usedAt);

  /** 写剪贴板。失败就把内容摊出来，不能让家长以为复制成功了、结果粘出个空。 */
  async function copyMessage(code: string) {
    const text = inviteMessage(window.location.origin, code);
    try {
      // 非 HTTPS（比如局域网 http://192.168.x.x）下 navigator.clipboard 是 undefined
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setFallback(null);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 2500);
    } catch {
      setFallback(text);
    }
  }

  function generate() {
    startTransition(async () => {
      const { code } = await createInviteCodeAction();
      await copyMessage(code);
      // 服务端已经 revalidate，这一下是让当前页面把新码渲染出来
      router.refresh();
    });
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
        一个码只能用一次。<b>点下面的按钮会生成一个码，并把「码 + 注册链接 + 简单说明」
        整段复制到剪贴板</b>，直接粘到微信发给朋友就行。
        没有未使用的码时，注册页会自动关闭。
      </p>

      <div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "生成中…" : "＋ 生成邀请码并复制邀请语"}
        </button>
      </div>

      {/* 剪贴板用不了（局域网 http 下就是这样）时，把内容摊出来让家长自己选中复制 */}
      {fallback && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-nes-red">
            这个环境下浏览器不让直接写剪贴板（一般是因为不是 HTTPS）。下面这段自己选中复制：
          </p>
          <textarea
            readOnly
            rows={12}
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-none border-2 border-nes-black p-2 font-mono text-xs"
          />
        </div>
      )}

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
                    onClick={() => copyMessage(c.code)}
                    className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    {copied === c.code ? "已复制 ✓" : "复制邀请语"}
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
