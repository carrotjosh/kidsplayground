"use client";

import { useState } from "react";

import { EmojiPicker, REWARD_EMOJI_GROUPS } from "@/components/EmojiPicker";

export type RewardFieldValues = {
  title: string;
  cost: number;
  emoji: string | null;
  cooldownDays: number | null;
};

const COOLDOWN_PRESETS = [
  { value: "", label: "不限次数" },
  { value: "1", label: "每天一次" },
  { value: "7", label: "每周一次" },
  { value: "30", label: "每月一次" },
  { value: "custom", label: "自定义" },
];

/** 礼物表单字段，新增和编辑共用。 */
export function RewardFields({ initial }: { initial?: RewardFieldValues }) {
  // 初值不在预设里（比如 14 天）就落到"自定义"
  const initialCooldown = initial?.cooldownDays ?? null;
  const isPreset =
    initialCooldown === null || [1, 7, 30].includes(initialCooldown);
  const [preset, setPreset] = useState(
    isPreset ? (initialCooldown === null ? "" : String(initialCooldown)) : "custom"
  );

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">礼物名称</span>
          <input
            name="title"
            placeholder="乐高小汽车"
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
            placeholder="50"
            required
            defaultValue={initial?.cost ?? ""}
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
      </div>

      <EmojiPicker name="emoji" groups={REWARD_EMOJI_GROUPS} defaultValue={initial?.emoji ?? ""} />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-slate-500">兑换频率</span>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="rounded-none border-2 border-nes-black px-3 py-2"
          >
            {COOLDOWN_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {preset === "custom" ? (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">每</span>
              <input
                name="cooldownDays"
                type="number"
                min={1}
                required
                defaultValue={isPreset ? "" : String(initialCooldown)}
                className="w-24 rounded-none border-2 border-nes-black px-3 py-2"
              />
              <span className="text-slate-600">天最多一次</span>
            </label>
          ) : (
            // 非自定义时用隐藏字段把预设值提交上去，后端只认 cooldownDays 这一个字段
            <input type="hidden" name="cooldownDays" value={preset} />
          )}
        </div>
        <p className="text-xs text-slate-400">
          从上次兑换那一刻开始倒计时。比如「每月一次」= 换过之后 30 天内不能再换。
        </p>
      </div>
    </>
  );
}
