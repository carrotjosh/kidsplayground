"use client";

import type { PricedItemKind } from "@/lib/economyAudit";

import { setItemPriceAction } from "./actions";

/**
 * 体检表每一行后面的改价控件：一个输入框 + 保存，越界时多一个「调到 N」。
 *
 * 为什么每行都要有：整表按比例校准是一刀切，但家长多数时候只是想把**某一样**
 * 调进区间，或者按自己对这个孩子的判断单独改一个数——为此翻到礼物页、
 * 精灵球页、植物页各改一遍太绕，而体检页正是他发现问题的地方。
 *
 * **布局用固定宽度的三格，不用 flex 右对齐。** 右对齐的话，有「调到 N」的行
 * 会把输入框往左顶、没有的行输入框靠右，一列输入框的左边缘参差不齐；
 * 而且按钮宽度还跟着数字位数变（「调到 16」和「调到 532」不一样宽）。
 * 没有建议价时留一个等宽的空位，整列就齐了。
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
    <div className="flex items-center gap-2">
      <form action={setItemPriceAction.bind(null, kind, id)} className="flex items-center gap-1.5">
        <input
          name="cost"
          type="number"
          min={0}
          defaultValue={cost}
          aria-label="价格"
          className="w-20 shrink-0 rounded-none border-2 border-nes-black px-2 py-1 text-right text-sm tabular-nums"
        />
        <button
          type="submit"
          className="pixel-btn w-14 shrink-0 bg-white py-1 text-xs text-slate-700"
        >
          保存
        </button>
      </form>

      {/* 定宽 + 空位占位：没有建议价的行也占同样的宽度，一列才对得齐 */}
      <div className="w-24 shrink-0">
        {suggested !== null && (
          <form action={setItemPriceAction.bind(null, kind, id)}>
            <input type="hidden" name="cost" value={suggested} />
            <button
              type="submit"
              title={`把它调到刚好进入设计区间：${cost} → ${suggested}`}
              className="pixel-btn w-full bg-nes-yellow py-1 text-xs tabular-nums text-nes-black"
            >
              调到 {suggested}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
