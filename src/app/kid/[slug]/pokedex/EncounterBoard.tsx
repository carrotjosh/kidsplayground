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
 * 「今天遇到的宝可梦」+ 对每一只选球去抓。
 *
 * 为什么是客户端组件：**结果要留在屏幕上**。抓到什么、挣脱了还是跑了，得让孩子看到；
 * 光靠服务端 revalidate，页面会直接刷成新状态，那一下的输赢就没了。
 *
 * 关于拼音：这里**不能**用 <Pinyin>——它依赖 pinyin-pro，那是一整本字典，
 * 打进浏览器包会让 Turbopack 生成产物时直接崩掉（踩过）。所以：
 *   固定文案 → 服务端页面预渲染成 ReactNode 传进来（labels）
 *   动态结果 → Server Action 返回已标注好的 Annotated，用 <Ruby> 渲染
 */

export type BallOption = {
  id: string;
  tier: BallTier;
  cost: number;
  /** 用这个球抓这一只的成功率，服务端算好（0~1）。大师球是 1。 */
  chance: number;
};

export type EncounterView = {
  id: string;
  nameZh: string;
  types: string[];
  rarity: number;
  artUrl: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  ability: string;
  moveName: string;
  movePower: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  isShiny: boolean;
  attemptsLeft: number;
  status: "AVAILABLE" | "CAUGHT" | "FLED";
};

export type BoardLabels = {
  /** 按球 id 索引的球名（服务端标好拼音） */
  ballTitles: Record<string, ReactNode>;
  /** 按 encounter id 索引的宝可梦名 */
  names: Record<string, ReactNode>;
  /** 按 encounter id 索引的"特性 / 技能"说明 */
  details: Record<string, ReactNode>;
  /** 按剩余次数索引的提示语。**不能传函数**——函数跨不过服务端→客户端的边界，
   *  所以在服务端把 1..N 每种情况都渲染好 */
  attemptsLeft: Record<number, ReactNode>;
  caught: ReactNode;
  fled: ReactNode;
  notEnough: ReactNode;
  throwing: ReactNode;
  shiny: ReactNode;
};

const GENDER_MARK = { MALE: "♂", FEMALE: "♀", UNKNOWN: "—" };

type State = ThrowResult | { error: string } | null;

export function EncounterBoard({
  slug,
  encounters,
  ballsByEncounter,
  balance,
  labels,
}: {
  slug: string;
  encounters: EncounterView[];
  /** 每只宝可梦一份球表：成功率跟稀有度走，所以不同的宝可梦同一个球的数字不一样 */
  ballsByEncounter: Record<string, BallOption[]>;
  balance: number;
  labels: BoardLabels;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {encounters.map((e) => (
        <EncounterCard
          key={e.id}
          slug={slug}
          encounter={e}
          balls={ballsByEncounter[e.id] ?? []}
          balance={balance}
          labels={labels}
        />
      ))}
    </div>
  );
}

function EncounterCard({
  slug,
  encounter,
  balls,
  balance,
  labels,
}: {
  slug: string;
  encounter: EncounterView;
  balls: BallOption[];
  balance: number;
  labels: BoardLabels;
}) {
  // 一张卡一个 action state：每只宝可梦的输赢各自留在自己的卡片上
  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (prev, formData) => {
      const ballId = String(formData.get("ballId") ?? "");
      return throwBallAction(slug, encounter.id, ballId, prev, formData);
    },
    null
  );

  // 结果回来之后以结果为准：服务端 revalidate 会把 encounter 刷成新状态，
  // 但两者到达时机不一定同步，用结果兜一下避免出现"抓到了但按钮还亮着"。
  const settled =
    encounter.status !== "AVAILABLE" || (state !== null && !("error" in state) && state.outcome === "CAUGHT");
  const done = settled || encounter.attemptsLeft <= 0;

  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-4">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- 外链官方立绘，不走 next/image 代理 */}
        <img
          src={encounter.artUrl}
          alt=""
          className={`h-28 w-28 shrink-0 object-contain ${done && encounter.status === "FLED" ? "opacity-40 grayscale" : ""}`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="kid-text text-xl text-slate-800">
            {labels.names[encounter.id]}{" "}
            <span className="text-slate-400">{GENDER_MARK[encounter.gender]}</span>
            {encounter.isShiny && <span className="ml-1 text-amber-500">✨</span>}
          </p>
          <p className="kid-text text-sm text-amber-600">
            {"★".repeat(encounter.rarity)} {RARITY_LABELS[encounter.rarity]}
            {encounter.isShiny && <> · {labels.shiny}</>}
          </p>
          <p className="kid-text text-xs text-slate-500">{labels.details[encounter.id]}</p>
          {/* 四项能力值，给"值不值得用好球"一个判断依据 */}
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
            {[
              ["HP", encounter.hp],
              ["攻", encounter.attack],
              ["防", encounter.defense],
              ["速", encounter.speed],
            ].map(([k, v]) => (
              <span key={k as string} className="pixel-border bg-slate-100 px-1.5">
                {k} {v}
              </span>
            ))}
          </div>
        </div>
      </div>

      {done ? (
        <p
          className={`pixel-border kid-text p-2 text-center text-base ${
            encounter.status === "CAUGHT" || (state && !("error" in state) && state.outcome === "CAUGHT")
              ? "bg-nes-green text-white"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {encounter.status === "FLED" ? labels.fled : labels.caught}
        </p>
      ) : (
        <>
          <p className="kid-text text-center text-sm text-slate-500">
            {labels.attemptsLeft[encounter.attemptsLeft]}
          </p>
          <form action={formAction} className="grid grid-cols-2 gap-2">
            {balls.map((ball) => {
              const affordable = balance >= ball.cost;
              return (
                <button
                  key={ball.id}
                  type="submit"
                  name="ballId"
                  value={ball.id}
                  disabled={!affordable || isPending}
                  className={`pixel-btn flex flex-col items-center gap-0.5 px-1 py-2 ${
                    affordable && !isPending
                      ? "bg-white text-slate-800"
                      : "cursor-not-allowed bg-slate-200 text-slate-400"
                  }`}
                >
                  <BallSprite tier={ball.tier} className="h-8 w-8" />
                  <span className="kid-text text-xs">{labels.ballTitles[ball.id]}</span>
                  <span className="pixel-font text-[9px] text-nes-brown">{ball.cost} ☀️</span>
                  {/* 把成功率直接摆出来：这是"该用哪个球"唯一有意义的依据，
                      也顺便让孩子对概率有点直观感受 */}
                  <span className="kid-text text-[11px] text-nes-green">
                    {Math.round(ball.chance * 100)}%
                  </span>
                </button>
              );
            })}
          </form>
          {isPending && (
            <p className="kid-text text-center text-sm text-slate-500">{labels.throwing}</p>
          )}
          {!balls.some((b) => balance >= b.cost) && (
            <p className="kid-text text-center text-sm text-nes-red">{labels.notEnough}</p>
          )}
        </>
      )}

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
      <Ruby annotated={state.title} className="kid-text text-base" />
      {state.notes.map((note: Annotated, i: number) => (
        <Ruby key={i} annotated={note} className="kid-text text-xs" />
      ))}
    </div>
  );
}
