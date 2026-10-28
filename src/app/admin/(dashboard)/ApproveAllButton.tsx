"use client";

import { useActionState } from "react";

import { approveAllAction } from "./history/actions";

/**
 * 一键审批。
 *
 * 带确认框：这一下会真的发出阳光，而且撤销要一条一条来。确认框里把条数和金额说清楚，
 * 家长看一眼就知道按下去会发生什么——所以它不是纯粹的拦路，是最后一次核对。
 *
 * 不用 <form action>，因为要先弹确认框；useActionState 的第二个返回值可以直接在
 * onClick 里调（React 会把它包进 transition），pending 期间按钮变灰防连点。
 */
export function ApproveAllButton({ count, points }: { count: number; points: number }) {
  const [message, run, pending] = useActionState(async () => approveAllAction(), null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`把这 ${count} 项全部批准，发出 ${points} 阳光？\n\n批完想改的话，要到「打卡记录」里一条一条撤销。`)) {
            run();
          }
        }}
        className="pixel-btn bg-nes-green px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "批准中..." : `一键审批（${count} 项 · ${points} 阳光）`}
      </button>
      {message && <span className="text-sm text-nes-green">{message}</span>}
    </div>
  );
}
