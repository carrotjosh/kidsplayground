"use client";

import { useActionState, useRef, useState } from "react";

import { formatCooldown } from "@/lib/cooldown";

import { deleteRewardAction, toggleRewardActiveAction, updateRewardAction } from "./actions";
import { RewardFields, type RewardFieldValues } from "./RewardFields";

export function RewardRow({
  reward,
}: {
  reward: RewardFieldValues & { id: string; active: boolean };
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await updateRewardAction(reward.id, prev, formData);
      if (result === null) setEditing(false);
      return result;
    },
    null
  );
  const deleteFormRef = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-3 pixel-card bg-amber-50 p-5">
        <h3 className="font-semibold">编辑「{reward.title}」</h3>
        <p className="text-xs text-slate-500">
          改动只影响之后的兑换；已经产生的兑换记录保留原来的名称和价格。
        </p>

        <RewardFields initial={reward} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="pixel-btn bg-nes-green px-4 py-2 text-white disabled:opacity-50"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="pixel-btn bg-white px-4 py-2 text-slate-600"
          >
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 pixel-card bg-white p-4">
      <div className="min-w-0">
        <p className="font-semibold">
          {reward.emoji} {reward.title}（{reward.cost} 阳光）
          {!reward.active && <span className="ml-2 text-xs text-slate-400">已下架</span>}
        </p>
        <p className="text-sm text-slate-500">
          {formatCooldown(reward.cooldownDays)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
        >
          编辑
        </button>

        <form action={toggleRewardActiveAction.bind(null, reward.id, !reward.active)}>
          <button
            type="submit"
            className={
              reward.active
                ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
            }
          >
            {reward.active ? "下架" : "上架"}
          </button>
        </form>

        <form ref={deleteFormRef} action={deleteRewardAction.bind(null, reward.id)}>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `确定删除礼物「${reward.title}」吗？\n\n孩子的礼物商店里不再显示，但已经兑换过的记录会保留。\n如果只是暂时不想让孩子换，用「下架」就行。`
                )
              ) {
                deleteFormRef.current?.requestSubmit();
              }
            }}
            className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
          >
            删除
          </button>
        </form>
      </div>
    </div>
  );
}
