"use client";

import { useActionState } from "react";

import { EmojiPicker, PLANT_EMOJI_GROUPS } from "@/components/EmojiPicker";

import { createPlantTypeAction } from "./actions";

export function PlantTypeForm() {
  const [error, formAction, isPending] = useActionState(createPlantTypeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增植物</h2>
      <div className="flex flex-wrap gap-3">
        <input
          name="title"
          placeholder="植物名称，比如：向日葵"
          required
          className="min-w-48 flex-1 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="cost"
          type="number"
          min={1}
          placeholder="所需阳光"
          required
          className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
        />
      </div>

      <EmojiPicker name="emoji" groups={PLANT_EMOJI_GROUPS} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增植物"}
      </button>
    </form>
  );
}
