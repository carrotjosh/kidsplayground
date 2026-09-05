"use client";

import { useActionState } from "react";

import { adjustPointsAction } from "./actions";

export function AdjustPointsForm() {
  const [error, formAction, isPending] = useActionState(adjustPointsAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">手动加/减分</h2>
      <div className="flex flex-wrap gap-3">
        <input
          name="amount"
          type="number"
          placeholder="分值，减分填负数，比如 -5"
          required
          className="w-56 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <input
          name="reason"
          placeholder="原因，比如：主动帮忙做家务"
          required
          className="flex-1 rounded-none border-2 border-nes-black px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "提交调整"}
      </button>
    </form>
  );
}
