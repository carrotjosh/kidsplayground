"use client";

import { useActionState } from "react";

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

export function TemplateForm() {
  const [error, formAction, isPending] = useActionState(createTemplateAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增周期性任务</h2>

      <div className="flex gap-3">
        <input
          name="title"
          placeholder="任务名称，比如：读书20分钟"
          required
          className="flex-1 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="emoji"
          placeholder="emoji，比如 📖"
          maxLength={4}
          className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="points"
          type="number"
          min={1}
          placeholder="分值"
          required
          className="w-24 rounded-none border-2 border-nes-black px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {WEEKDAYS.map((day) => (
          <label key={day.value} className="flex items-center gap-1">
            <input type="checkbox" name="weekdays" value={day.value} />
            {day.label}
          </label>
        ))}
      </div>

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
