import type { ReactNode } from "react";

import { Pinyin } from "@/components/Pinyin";

/**
 * 礼物商店 / 花园里"可以买的东西"卡片。两处长得一样，就共用一份，顺便把对齐问题一次解决：
 *
 *   h-full          —— 网格默认 stretch，卡片高度跟着一排里最高的那张走，一排卡片等高；
 *   标题区 flex-1   —— 标题一行还是两行的差异全被这块吸收，
 *                      于是不管标题多长，价格、备注、按钮在一排里都在同一条水平线上；
 *   note 永远渲染   —— 没有备注就留一个等高的空行，避免"有冷却限制的卡片"把按钮往下顶。
 */
export function ShopCard({
  emoji,
  art,
  title,
  cost,
  note,
  children,
}: {
  emoji: string;
  /** 传了就用它替代 emoji（花园里的植物用手绘插画）。图框高度两者一致，一排卡片还是齐的。 */
  art?: ReactNode;
  title: string;
  cost: number;
  /** 副说明，比如"每周最多一次"。传 null 也会占位，保证一排按钮齐平。 */
  note?: string | null;
  /** 底部的操作按钮 */
  children: ReactNode;
}) {
  return (
    <div className="pixel-card flex h-full flex-col items-center gap-2 bg-white p-4 text-center">
      {/* 图框固定高度：插画和 emoji 占的位置一样大，换哪种都不会把下面的内容顶歪 */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center text-5xl leading-none lg:h-16 lg:w-16 lg:text-6xl">
        {art ?? emoji}
      </div>

      <div className="flex flex-1 items-center">
        <p className="kid-text text-lg text-slate-800 lg:text-xl">
          <Pinyin text={title} />
        </p>
      </div>

      <p className="pixel-font text-[10px] text-nes-brown lg:text-xs">{cost} ☀️</p>
      {/* 没有备注也保留这一行的高度，一排卡片的按钮才不会一高一低 */}
      <p className="min-h-4 text-xs text-slate-400">{note ?? " "}</p>

      {children}
    </div>
  );
}
