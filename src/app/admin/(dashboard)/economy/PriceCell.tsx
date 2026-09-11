"use client";

import type { PricedItemKind } from "@/lib/economyAudit";

import { setItemPriceAction } from "./actions";

/**
 * 体检表每一行后面的改价控件：一个输入框 + 保存，越界时多一个「调进区间」。
 *
 * 为什么每行都要有：整表按比例校准是一刀切，但家长多数时候只是想把**某一样**
 * 调进区间，或者按自己对这个孩子的判断单独改一个数——为此翻到礼物页、
 * 精灵球页、植物页各改一遍太绕，而体检页正是他发现问题的地方。
 */
export function PriceCell({
  kind,
  id,
  cost,
  suggested,
}: {
  kind: PricedItemKind;
  id: string;
  cost: number;
  suggested: number | null;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <form action={setItemPriceAction.bind(null, kind, id)} className="flex items-center gap-1">
        <input
          name="cost"
          type="number"
          min={0}
          defaultValue={cost}
          aria-label="价格"
          className="w-20 rounded-none border-2 border-nes-black px-1 py-0.5 text-right text-sm tabular-nums"
        />
        <button type="submit" className="pixel-btn bg-white px-2 py-0.5 text-xs text-slate-700">
          保存
        </button>
      </form>

      {/* 建议价只在越界时才有。按钮上直接写出会变成多少，点下去不会有意外 */}
      {suggested !== null && (
        <form action={setItemPriceAction.bind(null, kind, id)}>
          <input type="hidden" name="cost" value={suggested} />
          <button
            type="submit"
            title={`把它调到设计区间的中点：${cost} → ${suggested}`}
            className="pixel-btn bg-nes-yellow px-2 py-0.5 text-xs text-nes-black"
          >
            调到 {suggested}
          </button>
        </form>
      )}
    </div>
  );
}
