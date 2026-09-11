"use client";

import { useState } from "react";

export type PreviewRow = { kind: string; label: string; from: number };

/**
 * 校准表单：填一个百分比，实时看到每个价格会变成多少，确认后提交。
 *
 * 做成客户端组件是为了**实时预览**。改价会立刻反映到孩子端，家长必须在按下去之前
 * 就看见"玩具 200 → 230"这一行，而不是提交完才发现调多了。
 * 预览用的乘法和服务端是同一条（Math.max(1, round(from × factor))），
 * 但服务端会自己重算一遍，不采信这里的结果。
 */
export function RecalibrateForm({
  action,
  rows,
  fullPercent,
}: {
  action: (formData: FormData) => Promise<void>;
  rows: PreviewRow[];
  /** 一次调到位需要涨百分之几。作为输入框的默认值。 */
  fullPercent: number;
}) {
  const [percent, setPercent] = useState(String(fullPercent));

  const value = Number(percent);
  const valid = Number.isFinite(value) && Math.abs(value) >= 1 && value > -60 && value <= 200;
  const factor = 1 + value / 100;
  const scale = (n: number) => Math.max(1, Math.round(n * factor));
  const changed = valid ? rows.filter((r) => scale(r.from) !== r.from) : [];

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`确定把 ${changed.length} 个价格按 ${factor.toFixed(2)}× 改一遍吗？孩子端会立刻看到新价格。`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600">
          价格上调
          <input
            name="percent"
            type="number"
            step="1"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="mx-2 w-20 border-2 border-nes-black px-2 py-1 text-right tabular-nums"
          />
          %
        </label>
        {/* 一次涨满对孩子是个不小的打击，所以给几个常用的小幅度当快捷键 */}
        {[10, 15, 20, fullPercent].map((p, i) => (
          <button
            key={`${p}-${i}`}
            type="button"
            onClick={() => setPercent(String(p))}
            className={`border-2 px-2 py-1 text-xs ${
              Number(percent) === p
                ? "border-nes-black bg-nes-yellow"
                : "border-slate-200 text-slate-500"
            }`}
          >
            {p === fullPercent ? `一次调到位 ${p}%` : `${p}%`}
          </button>
        ))}
        <button
          type="submit"
          disabled={!valid || changed.length === 0}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-40"
        >
          按 {valid ? factor.toFixed(2) : "?"}× 调整
        </button>
      </div>

      {!valid && <p className="text-sm text-nes-red">请填 -60 到 200 之间、绝对值至少 1 的数字。</p>}

      {valid && (
        <div className="flex flex-wrap gap-2 text-sm">
          {changed.map((r) => (
            <span key={`${r.kind}-${r.label}`} className="border-2 border-slate-200 px-2 py-1">
              {r.label} <span className="text-slate-400">{r.from}</span> →{" "}
              <b className="text-slate-800">{scale(r.from)}</b>
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
