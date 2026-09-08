"use client";

import { useActionState } from "react";

import { EmojiPicker, TASK_EMOJI_GROUPS } from "@/components/EmojiPicker";

import { createAdhocAction } from "./actions";

export function AdhocForm({ defaultDate }: { defaultDate: string }) {
  const [error, formAction, isPending] = useActionState(createAdhocAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增临时任务</h2>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">主题</span>
          <input
            name="subject"
            placeholder="默写生字"
            required
            className="w-40 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">数值（可留空）</span>
          <input
            name="amount"
            type="number"
            min={1}
            placeholder="10"
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">单位（可留空）</span>
          <input
            name="unit"
            placeholder="个"
            maxLength={6}
            className="w-24 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">奖励阳光</span>
          <input
            name="points"
            type="number"
            min={1}
            placeholder="10"
            required
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">日期</span>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            className="rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
      </div>

      <EmojiPicker name="emoji" groups={TASK_EMOJI_GROUPS} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增临时任务"}
      </button>
    </form>
  );
}
