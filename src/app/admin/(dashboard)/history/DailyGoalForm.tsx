"use client";

import { useActionState } from "react";

import { setDailyGoalAction } from "./actions";

export function DailyGoalForm({ current }: { current: number }) {
  const [error, formAction, isPending] = useActionState(setDailyGoalAction, null);

  return (
    <form action={formAction} className="pixel-card flex flex-col gap-2 bg-white p-4">
      <h2 className="font-semibold">每日达标线</h2>
      <p className="text-sm text-slate-500">
        当天已批准的任务加起来达到这么多阳光，这一天就算打卡成功（日历点亮、计入满勤统计）。
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          name="points"
          type="number"
          min={1}
          defaultValue={current}
          required
          className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <span className="text-sm text-slate-600">阳光 / 天</span>
        <button
          type="submit"
          disabled={isPending}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
