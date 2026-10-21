"use client";

import { useActionState, useState } from "react";

import { excuseDayAction, unexcuseDayAction } from "./actions";

const QUICK_REASONS = ["生病", "发烧", "出门", "考试周"];

/**
 * 「这天请假」。孩子生病、全家出门的日子，标一下就不算没打卡：
 * 不跑宝可梦、不影响满勤奖、不打断连续达标。任务本身不动，他想做照样能做。
 */
export function ExcuseForm({ date, currentReason }: { date: string; currentReason: string | null }) {
  const [message, formAction, pending] = useActionState(excuseDayAction.bind(null, date), null);
  const [reason, setReason] = useState(currentReason ?? "");

  if (currentReason) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-sky-300 bg-sky-50 p-3">
        <span className="text-sm">
          🩹 这天请假了：<b>{currentReason}</b>
          <span className="ml-2 text-xs text-slate-500">不跑宝可梦、不影响满勤奖和连续达标</span>
        </span>
        <form action={unexcuseDayAction.bind(null, date)}>
          <button type="submit" className="pixel-btn bg-white px-3 py-1 text-sm text-slate-600">
            撤销请假
          </button>
        </form>
        {message && <p className="w-full text-sm text-nes-green">{message}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 border-2 border-dashed border-slate-300 p-3">
      <p className="text-sm">
        <b>这天请假</b>
        <span className="ml-2 text-xs text-slate-500">
          生病、出门这类允许不打卡的日子：不跑宝可梦、不影响满勤奖、不打断连续达标。
          这天要是已经跑掉了一只，会一起回来。
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {QUICK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`border-2 px-2 py-0.5 text-sm ${reason === r ? "border-nes-black bg-amber-100" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {r}
          </button>
        ))}
        <input
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="原因"
          maxLength={20}
          required
          className="w-32 rounded-none border-2 border-nes-black px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="pixel-btn bg-sky-500 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {pending ? "保存中..." : "标记请假"}
        </button>
      </div>
      {message && (
        <p className={`text-sm ${message.startsWith("✅") ? "text-nes-green" : "text-red-500"}`}>{message}</p>
      )}
    </form>
  );
}
