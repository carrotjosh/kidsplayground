"use client";

import { useActionState, useState } from "react";

import { saveWebhookAction, testWebhookAction } from "./actions";

export function WebhookForm({ current }: { current: string | null }) {
  // 输入框受控：这样"测试"按钮能拿到还没保存的地址，先试通了再存
  const [url, setUrl] = useState(current ?? "");
  const [saveError, saveAction, saving] = useActionState(saveWebhookAction, null);
  const [testResult, testAction, testing] = useActionState(testWebhookAction, null);

  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-5">
      <h2 className="font-semibold">待办通知</h2>
      <p className="text-sm text-slate-500">
        孩子提交打卡、申请兑换礼物时，往这个地址推一条消息，你在微信里就能看到，不用一直盯着后台。
        留空就是关闭。
      </p>

      <input
        name="webhookUrl"
        form="webhook-save"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://sctapi.ftqq.com/你的KEY.send"
        className="w-full rounded-none border-2 border-nes-black px-3 py-2"
      />

      <div className="flex flex-wrap gap-2">
        <form id="webhook-save" action={saveAction}>
          <button
            type="submit"
            disabled={saving}
            className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </form>

        {/* 测试用独立的 form，把当前输入框里的值带上——不用先保存就能试 */}
        <form action={testAction}>
          <input type="hidden" name="webhookUrl" value={url} />
          <button
            type="submit"
            disabled={testing || !url.trim()}
            className="pixel-btn bg-white px-4 py-2 text-slate-700 disabled:opacity-40"
          >
            {testing ? "发送中..." : "发送测试通知"}
          </button>
        </form>
      </div>

      {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      {testResult && (
        <p className={`text-sm ${testResult.startsWith("✅") ? "text-nes-green" : "text-red-500"}`}>
          {testResult}
        </p>
      )}

      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer">怎么拿到这个地址？</summary>
        <div className="mt-2 flex flex-col gap-1">
          <p>
            <b>Server 酱</b>（最省事，微信里收）：去 sct.ftqq.com 用微信扫码登录，拿到 SendKey，
            地址就是 <code>https://sctapi.ftqq.com/你的KEY.send</code>
          </p>
          <p>
            <b>企业微信群机器人</b>：在群里添加机器人，复制它的 Webhook 地址，整条粘进来。
          </p>
          <p className="text-slate-400">
            也支持 PushPlus、PushDeer、Bark；其它服务会以 {"{title, content}"} 的 JSON 发送。
          </p>
        </div>
      </details>
    </div>
  );
}
