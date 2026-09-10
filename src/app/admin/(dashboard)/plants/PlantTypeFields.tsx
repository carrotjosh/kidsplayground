"use client";

import { EmojiPicker, PLANT_EMOJI_GROUPS } from "@/components/EmojiPicker";

export type PlantTypeFieldValues = {
  title: string;
  cost: number;
  emoji: string | null;
};

/** 植物表单字段，新增和编辑共用。 */
export function PlantTypeFields({ initial }: { initial?: PlantTypeFieldValues }) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">植物名称</span>
          <input
            name="title"
            placeholder="向日葵"
            required
            defaultValue={initial?.title ?? ""}
            className="w-56 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">所需阳光</span>
          <input
            name="cost"
            type="number"
            min={1}
            placeholder="15"
            required
            defaultValue={initial?.cost ?? ""}
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
      </div>

      <EmojiPicker name="emoji" groups={PLANT_EMOJI_GROUPS} defaultValue={initial?.emoji ?? ""} />
    </>
  );
}
