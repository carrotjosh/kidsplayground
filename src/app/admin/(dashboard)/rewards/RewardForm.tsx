"use client";

import { useActionState } from "react";

import { createRewardAction } from "./actions";
import { RewardFields } from "./RewardFields";

export function RewardForm() {
  const [error, formAction, isPending] = useActionState(createRewardAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增礼物</h2>

      <RewardFields />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增礼物"}
      </button>
    </form>
  );
}
