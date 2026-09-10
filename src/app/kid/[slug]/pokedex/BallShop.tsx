"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";

import { BallSprite } from "@/components/BallSprite";
import { Ruby, type Annotated } from "@/components/Ruby";
import type { BallTier } from "@/generated/prisma/client";
// 只 import type：lib/pokedex 是服务端模块（链式依赖 chinese-days），
// 引它的运行时值会把整条链拖进浏览器包。
import type { ThrowResult } from "@/lib/pokedex";
import { RARITY_LABELS } from "@/lib/rarity";

import { throwBallAction } from "./actions";

/**
 * 精灵球商店 + 扔球结果。
 *
 * 做成客户端组件是因为**结果要留在屏幕上**：抓到什么、跑掉了什么，得让孩子看到，
 * 光靠服务端 revalidate 页面会直接刷成新状态，那一下的输赢就没了。
 *
 * 关于拼音：这里**不能**用 <Pinyin>——它依赖 pinyin-pro，那是一整本字典，
 * 打进浏览器包会让 Turbopack 生成产物时直接崩掉（踩过）。所以：
 *   固定文案 → 服务端页面预渲染成 ReactNode 传进来（labels）
 *   动态结果 → Server Action 返回已标注好的 Annotated，用 <Ruby> 渲染
 */

export type Ball = { id: string; tier: BallTier; title: string; cost: number };

export type ShopLabels = {
  /** 每种球的名字，服务端标好拼音，按球 id 索引 */
  ballTitles: Record<string, ReactNode>;
  throwIt: ReactNode;
  notEnough: ReactNode;
  throwing: ReactNode;
  luckHint: ReactNode;
};

type State = ThrowResult | { error: string } | null;

export function BallShop({
  slug,
  balls,
  balance,
  missStreak,
  labels,
}: {
  slug: string;
  balls: Ball[];
  balance: number;
  missStreak: number;
  labels: ShopLabels;
}) {
  return (
    <div className="flex flex-col gap-3">
      {missStreak > 0 && (
        <p className="pixel-card kid-text bg-nes-yellow p-3 text-center text-base text-nes-black lg:text-lg">
          {labels.luckHint} 🍀
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {balls.map((ball) => (
          <BallCard
            key={ball.id}
            slug={slug}
            ball={ball}
            affordable={balance >= ball.cost}
            labels={labels}
          />
        ))}
      </div>
    </div>
  );
}

function BallCard({
  slug,
  ball,
  affordable,
  labels,
}: {
  slug: string;
  ball: Ball;
  affordable: boolean;
  labels: ShopLabels;
}) {
  // 绑上 slug 和球的 id 之后，签名正好是 useActionState 要的 (prevState, formData)
  const [state, formAction, isPending] = useActionState<State, FormData>(
    throwBallAction.bind(null, slug, ball.id),
    null
  );

  return (
    <div className="pixel-card flex flex-col items-center gap-2 bg-white p-3 text-center">
      <BallSprite tier={ball.tier} className="h-16 w-16" />
      <p className="kid-text text-base text-slate-800">{labels.ballTitles[ball.id]}</p>
      <p className="pixel-font text-[10px] text-nes-brown">{ball.cost} ☀️</p>

      <form action={formAction} className="w-full">
        <button
          type="submit"
          disabled={!affordable || isPending}
          className={`pixel-btn kid-text w-full px-2 py-2 text-base ${
            affordable && !isPending
              ? "bg-nes-red text-white"
              : "cursor-not-allowed bg-slate-300 text-slate-500"
          }`}
        >
          {isPending ? labels.throwing : affordable ? labels.throwIt : labels.notEnough}
        </button>
      </form>

      {state && <ThrowFeedback state={state} />}
    </div>
  );
}

function ThrowFeedback({ state }: { state: NonNullable<State> }) {
  if ("error" in state) {
    return <p className="kid-text text-sm text-nes-red">{state.error}</p>;
  }

  const caught = state.outcome === "CAUGHT";
  return (
    <div
      className={`pixel-border flex w-full flex-col items-center gap-1 p-2 ${
        caught ? "bg-nes-green text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 外链官方立绘，不走 next/image 代理 */}
      <img
        src={state.artUrl}
        alt=""
        className={`h-16 w-16 object-contain ${caught ? "" : "opacity-50 grayscale"}`}
      />
      <Ruby annotated={state.title} className="kid-text text-sm" />
      <span className="kid-text text-xs">
        {"★".repeat(state.rarity)} {RARITY_LABELS[state.rarity]}
      </span>
      {state.notes.map((note: Annotated, i: number) => (
        <Ruby key={i} annotated={note} className="kid-text text-xs" />
      ))}
    </div>
  );
}
