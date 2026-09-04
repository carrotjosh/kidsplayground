"use client";

import { useActionState } from "react";

import { createRewardAction } from "./actions";

export function RewardForm() {
  const [error, formAction, isPending] = useActionState(createRewardAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">新增礼物</h2>
      <div className="flex flex-wrap gap-3">
        <input
          name="title"
          placeholder="礼物名称，比如：乐高小汽车"
          required
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="emoji"
          placeholder="emoji，比如 🚗"
          maxLength={4}
          className="w-28 rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="cost"
          type="number"
          min={1}
          placeholder="所需积分"
          required
          className="w-28 rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增礼物"}
      </button>
    </form>
  );
}
