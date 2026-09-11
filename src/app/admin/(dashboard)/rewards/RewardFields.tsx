"use client";

import { useState } from "react";

import { EmojiPicker, REWARD_EMOJI_GROUPS } from "@/components/EmojiPicker";
import { LEVELS } from "@/lib/levelTable";

export type RewardFieldValues = {
  title: string;
  cost: number;
  emoji: string | null;
  cooldownDays: number | null;
  unlockLevel: number;
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

      <div className="flex flex-col gap-2">
        <span className="text-xs text-slate-500">几级解锁</span>
        <select
          name="unlockLevel"
          defaultValue={String(initial?.unlockLevel ?? 1)}
          className="w-72 rounded-none border-2 border-nes-black px-3 py-2"
        >
          {LEVELS.map((lv, i) => (
            <option key={i} value={i + 1}>
              Lv.{i + 1} {lv.title}
              {i > 0 && `（累计打卡挣满 ${lv.need} 阳光）`}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400">
          没到这一级，孩子在商店里会看到一张灰色的「N 级解锁」卡片——
          看得见够不着才是目标，直接藏起来就只是不存在。
          <br />
          定级原则是<b>让等级跟在价格后面</b>：孩子攒够钱的时候差不多刚好到那一级，
          于是等级几乎不会真的挡住他，只负责控制「什么时候看见」。
          大愿望（比如迪士尼）放到高等级，能天然把你的现金支出往后推。
        </p>
      </div>
    </>
  );
}
