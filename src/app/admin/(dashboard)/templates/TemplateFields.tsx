"use client";

import { useState } from "react";

import { EmojiPicker, TASK_EMOJI_GROUPS } from "@/components/EmojiPicker";

const WEEKDAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];

const SCHEDULE_OPTIONS = [
  { value: "WEEKDAYS", label: "按星期几", hint: "自己勾选周一到周日" },
  { value: "WORKDAY", label: "法定工作日", hint: "跟着国家放假安排走，含调休上学的周末" },
  { value: "HOLIDAY", label: "法定节假日", hint: "春节、国庆这类法定假期（不含普通周末）" },
];

export type TemplateFieldValues = {
  subject: string;
  amount: number | null;
  unit: string | null;
  points: number;
  emoji: string | null;
  scheduleType: string;
  weekdays: number[];
};

/**
 * 任务模板的表单字段，新增和编辑共用一份，避免两处各写一套以后改漏。
 * 字段名和 lib/taskName.ts 的 parseTaskFields、actions.ts 里的解析保持一致。
 */
export function TemplateFields({ initial }: { initial?: TemplateFieldValues }) {
  const [scheduleType, setScheduleType] = useState(initial?.scheduleType ?? "WEEKDAYS");

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">主题</span>
          <input
            name="subject"
            placeholder="读书"
            required
            defaultValue={initial?.subject ?? ""}
            className="w-40 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">数值（可留空）</span>
          <input
            name="amount"
            type="number"
            min={1}
            placeholder="20"
            defaultValue={initial?.amount ?? ""}
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">单位（可留空）</span>
          <input
            name="unit"
            placeholder="分钟"
            maxLength={6}
            defaultValue={initial?.unit ?? ""}
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
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
            defaultValue={initial?.points ?? ""}
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
      </div>

      <EmojiPicker name="emoji" groups={TASK_EMOJI_GROUPS} defaultValue={initial?.emoji ?? ""} />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-slate-500">什么时候生效</span>
        <div className="flex flex-wrap gap-4">
          {SCHEDULE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="scheduleType"
                value={opt.value}
                checked={scheduleType === opt.value}
                onChange={() => setScheduleType(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">{opt.label}</span>
                <br />
                <span className="text-xs text-slate-400">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {scheduleType === "WEEKDAYS" && (
        <div className="flex flex-wrap gap-3 text-sm">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="weekdays"
                value={day.value}
                defaultChecked={initial?.weekdays.includes(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
