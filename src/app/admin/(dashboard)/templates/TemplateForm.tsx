"use client";

import { useActionState, useState } from "react";

import { EmojiPicker, TASK_EMOJI_GROUPS } from "@/components/EmojiPicker";

import { createTemplateAction } from "./actions";

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
  { value: "WORKDAY", label: "法定工作日", hint: "跟着国家放假安排走，含调休补班的周末" },
  { value: "HOLIDAY", label: "法定节假日", hint: "春节、国庆这类法定假期（不含普通周末）" },
];

export function TemplateForm() {
  const [error, formAction, isPending] = useActionState(createTemplateAction, null);
  const [scheduleType, setScheduleType] = useState("WEEKDAYS");

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增周期性任务</h2>
      <p className="text-sm text-slate-500">
        主题、数值、单位分开填，孩子端会分行显示、数值放大，比一整串文字好认。
        数值和单位可以留空（比如「整理书包」这种没有数量的任务）。
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">主题</span>
          <input
            name="subject"
            placeholder="读书"
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
            placeholder="20"
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">单位（可留空）</span>
          <input
            name="unit"
            placeholder="分钟"
            maxLength={6}
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
            className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
          />
        </label>
      </div>

      <EmojiPicker name="emoji" groups={TASK_EMOJI_GROUPS} />

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
              <input type="checkbox" name="weekdays" value={day.value} />
              {day.label}
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增任务模板"}
      </button>
    </form>
  );
}
