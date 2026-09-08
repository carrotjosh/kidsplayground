"use client";

import { useState } from "react";

/**
 * emoji 条目：大多数一眼能认出来，少数容易认错的加个名字，
 * 鼠标悬停能看到（触屏设备靠分组名区分）。
 */
export type EmojiItem = string | { emoji: string; label: string };

export type EmojiGroup = { label: string; emojis: EmojiItem[] };

export function emojiOf(item: EmojiItem): string {
  return typeof item === "string" ? item : item.emoji;
}

export function labelOf(item: EmojiItem): string | undefined {
  return typeof item === "string" ? undefined : item.label;
}

/** 任务用的预设 emoji，按学习 App/学习/运动/生活习惯/兴趣爱好分组。 */
export const TASK_EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "学习 App",
    emojis: [
      // Unicode 没有多邻国官方图标，绿猫头鹰是它的吉祥物，最贴近
      { emoji: "🦉", label: "多邻国（猫头鹰）" },
      { emoji: "🟢", label: "多邻国（绿色）" },
      { emoji: "🗣️", label: "口语/跟读" },
      { emoji: "🎧", label: "听力" },
      { emoji: "📱", label: "App 打卡" },
      { emoji: "🔤", label: "英语单词" },
      { emoji: "🈶", label: "语文" },
      { emoji: "🧮", label: "数学/口算" },
    ],
  },
  {
    label: "学习",
    emojis: ["📖", "📚", "✏️", "📝", "🔢", "🖊️", "📐", "🗂️", "🧠", "🔬", "🌏", "🧪", "💻", "📔"],
  },
  {
    label: "运动",
    emojis: ["🏃", "⚽", "🏀", "🏊", "🚴", "🤸", "🏸", "🏓", "⛹️", "🧗", "🥋", "🛹", "⛸️", "🤾", "🪀", "🏐"],
  },
  {
    label: "生活习惯",
    emojis: ["🦷", "🛏️", "🧹", "🍚", "🥦", "🚿", "🧺", "🗑️", "👕", "🧴", "⏰", "🧦", "🍎", "💧", "🪥", "🧼"],
  },
  {
    label: "兴趣爱好",
    emojis: ["🎹", "🎸", "🎨", "🎻", "🥁", "🎤", "♟️", "🧩", "🪁", "🎬", "📷", "🌱", "🐟", "🧶", "🩰", "🎭"],
  },
];

/** 礼物用的预设 emoji。 */
export const REWARD_EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "玩乐",
    emojis: ["🎁", "🧸", "🚗", "🪁", "🎠", "🎡", "🎢", "🏖️", "🎪", "🎮", "🧩", "⚽", "🛴", "🪆", "🚂", "🦖"],
  },
  {
    label: "吃喝",
    emojis: ["🍦", "🍰", "🍫", "🍔", "🍕", "🍓", "🧁", "🍿", "🥤", "🍩", "🍜", "🍡", "🥟", "🍇", "🍭", "🧋"],
  },
  {
    label: "特权",
    emojis: ["📺", "🎬", "📱", "🕹️", "🛌", "🌙", "🎧", "🎫", "🏕️", "🚙", "🐶", "📔", "🗺️", "🎈", "⭐", "👑"],
  },
];

/** 植物用的预设 emoji。 */
export const PLANT_EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "植物",
    emojis: ["🌻", "🌱", "🌵", "🌿", "🍀", "🌳", "🌲", "🌴", "🪴", "🌷", "🌸", "🌺", "🌹", "🍄", "🎋", "🌾"],
  },
  {
    label: "果实/道具",
    emojis: ["🥜", "🍒", "🌰", "🫐", "🍋", "🌽", "🎃", "🍉", "🥕", "🧊", "🔥", "⚡", "🛡️", "💣", "🟢", "☀️"],
  },
];

/**
 * emoji 选择器：点一下就填进隐藏的表单字段，也支持自己输入。
 * 用隐藏 input 承载表单值，避免受控 input 和 Server Action 的表单提交打架。
 */
export function EmojiPicker({
  name,
  groups,
  defaultValue = "",
  label = "图标",
}: {
  name: string;
  groups: EmojiGroup[];
  defaultValue?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={value} />

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="pixel-btn flex h-11 w-14 items-center justify-center bg-white text-2xl"
          aria-label="选择图标"
        >
          {value || "＋"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            className="text-xs text-slate-400 underline"
          >
            清除
          </button>
        )}
      </div>

      {open && (
        <div className="pixel-card flex flex-col gap-3 bg-white p-3">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="text-xs font-bold text-slate-500">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {group.emojis.map((item) => {
                  const emoji = emojiOf(item);
                  const name = labelOf(item);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      title={name}
                      onClick={() => {
                        setValue(emoji);
                        setOpen(false);
                      }}
                      className={`flex h-10 min-w-10 flex-col items-center justify-center border-2 px-1 transition ${
                        value === emoji
                          ? "border-nes-black bg-nes-yellow"
                          : "border-slate-200 bg-white hover:border-nes-black"
                      }`}
                    >
                      <span className="text-xl leading-none">{emoji}</span>
                      {name && (
                        <span className="mt-0.5 text-[8px] leading-none text-slate-500">
                          {name.replace(/（.*）/, "")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 border-t border-slate-200 pt-2">
            <span className="text-xs text-slate-500">或自己输入</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={4}
              placeholder="😀"
              className="w-20 rounded-none border-2 border-slate-300 px-2 py-1 text-center"
            />
          </div>
        </div>
      )}
    </div>
  );
}
