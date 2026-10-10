"use client";

import { setPenaltyEnabledAction } from "./actions";

/**
 * 「任务没做完会有后果」的开关。
 *
 * 为什么值得做成开关而不是写死：这条规则对刚开始用的孩子可能太硬——
 * 他还没建立起"每天都要做完"的习惯，就先眼看着攒了很久的宝可梦跑掉一只，
 * 挫败感会盖过激励。家长需要能先关掉、等孩子稳定了再打开。
 *
 * **关掉不等于冻结**：结算还是逐天跑完并推进游标，只是不执行惩罚。
 * 所以关一个月再打开不会被一次性补罚——那段日子就是真的不算了。
 */
export function PenaltyToggle({
  enabled,
  childName,
}: {
  enabled: boolean;
  childName: string;
}) {

  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-4">
      <h2 className="font-semibold">{childName}：任务没做完的后果</h2>
      <p className="text-sm text-slate-500">
        当天挣到的阳光不到 5，就会跑掉一只已经抓到的宝可梦；孩子已经点了「做完了」但你还没批的那天，先不算。
        不开 App 也躲不掉——下次打开会把欠下的日子一次算完。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <form action={setPenaltyEnabledAction.bind(null, true)}>
          <button
            type="submit"
            disabled={enabled}
            className={`pixel-btn px-4 py-2 ${
              enabled ? "cursor-default bg-nes-green text-white" : "bg-white text-slate-700"
            }`}
          >
            {enabled ? "✓ 开着" : "打开"}
          </button>
        </form>
        <form action={setPenaltyEnabledAction.bind(null, false)}>
          <button
            type="submit"
            disabled={!enabled}
            className={`pixel-btn px-4 py-2 ${
              !enabled ? "cursor-default bg-nes-red text-white" : "bg-white text-slate-700"
            }`}
          >
            {enabled ? "关掉" : "✓ 已关闭"}
          </button>
        </form>
      </div>

      {!enabled && (
        <p className="border-2 border-nes-red bg-amber-50 p-3 text-sm">
          现在关着。<b>关闭期间的日子不会被补罚</b>——以后重新打开，也只从打开那天起算。
        </p>
      )}
    </div>
  );
}
