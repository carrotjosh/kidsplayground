"use client";

import { setAutoApproveAction } from "./actions";

/**
 * 「孩子打卡要不要家长确认」的开关。
 *
 * 默认是要审批的，而且这个默认值是有意的：审批那一下本来就是一次亲子对话——
 * "今天这本书读完了吗""跳了几个"。真正的价值在那句话里，不在点按钮。
 *
 * 但孩子稳定之后，家长每天点十几次确认就是纯负担了，而且家长忘了批的时候
 * 阳光发不出去，孩子会以为系统坏了。所以给个开关，不是删掉审批。
 */
export function AutoApproveToggle({
  enabled,
  childName,
  pendingCount,
}: {
  enabled: boolean;
  childName: string;
  /** 现在还压着几条待审核——开启自动审批不会自动放行它们，要说清楚 */
  pendingCount: number;
}) {
  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-4">
      <h2 className="font-semibold">{childName}：打卡要不要你确认</h2>
      <p className="text-sm text-slate-500">
        关着的时候：孩子点「做完了」→ 进「打卡记录」等你批 → 你批了才发阳光。
        <br />
        开着的时候：孩子点「做完了」→ <b>阳光立刻到账</b>，你不用管。批错了照样能在「打卡记录」里撤销。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <form action={setAutoApproveAction.bind(null, false)}>
          <button
            type="submit"
            disabled={!enabled}
            className={`pixel-btn px-4 py-2 ${
              !enabled ? "cursor-default bg-nes-green text-white" : "bg-white text-slate-700"
            }`}
          >
            {enabled ? "改成要我确认" : "✓ 要我确认"}
          </button>
        </form>
        <form action={setAutoApproveAction.bind(null, true)}>
          <button
            type="submit"
            disabled={enabled}
            className={`pixel-btn px-4 py-2 ${
              enabled ? "cursor-default bg-nes-red text-white" : "bg-white text-slate-700"
            }`}
          >
            {enabled ? "✓ 自动审批中" : "改成自动审批"}
          </button>
        </form>
      </div>

      {enabled && pendingCount > 0 && (
        <p className="border-2 border-nes-black bg-amber-50 p-3 text-sm">
          还有 <b>{pendingCount}</b> 条在「打卡记录」里等着你批。
          <b>开自动审批不会自动放行它们</b>——那些是孩子在「要确认」的约定下点的，
          仍然需要你看一眼。
        </p>
      )}

      {!enabled && (
        <p className="text-sm text-slate-500">
          建议先保持「要我确认」。批的那一下本来就是一次对话——「今天这本书读完了吗」。
          等孩子稳定了、你觉得每天点确认变成负担了，再关掉。
        </p>
      )}
    </div>
  );
}
