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
        <input
          name="title"
          placeholder="任务名称，比如：默写生字"
          required
          className="min-w-48 flex-1 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="points"
          type="number"
          min={1}
          placeholder="阳光"
          required
          className="w-24 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="date"
          type="date"
          defaultValue={defaultDate}
          className="rounded-none border-2 border-nes-black px-3 py-2"
        />
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
