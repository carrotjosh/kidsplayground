"use client";

import { useActionState } from "react";

import { BallSprite } from "@/components/BallSprite";
import type { BallTier } from "@/generated/prisma/client";

import { toggleBallActiveAction, updateBallCostAction } from "./actions";

export function BallRow({
  ball,
  caughtCount,
}: {
  ball: { id: string; tier: BallTier; title: string; cost: number; catchPower: number; active: boolean };
  caughtCount: number;
}) {
  const [error, formAction, isPending] = useActionState(
    updateBallCostAction.bind(null, ball.id),
    null
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pixel-card bg-white p-4">
      <div className="flex min-w-0 items-center gap-3">
        <BallSprite tier={ball.tier} className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">
            {ball.title}
            {!ball.active && <span className="ml-2 text-xs text-slate-400">已下架</span>}
          </p>
          <p className="text-sm text-slate-500">
            抓取倍率 ×{ball.catchPower}
            {ball.tier === "MASTER" && "（必中）"} · 用它抓到过 {caughtCount} 只
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <form action={formAction} className="flex items-center gap-2">
          <input
            name="cost"
            type="number"
            min={1}
            defaultValue={ball.cost}
            className="w-24 rounded-none border-2 border-nes-black px-2 py-1"
          />
          <span className="text-sm text-slate-500">阳光</span>
          <button
            type="submit"
            disabled={isPending}
            className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700 disabled:opacity-50"
          >
            {isPending ? "…" : "改价"}
          </button>
        </form>

        <form action={toggleBallActiveAction.bind(null, ball.id, !ball.active)}>
          <button
            type="submit"
            className={
              ball.active
                ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
            }
          >
            {ball.active ? "下架" : "上架"}
          </button>
        </form>
      </div>
      {error && <p className="w-full text-sm text-red-500">{error}</p>}
    </div>
  );
}
