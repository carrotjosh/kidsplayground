"use client";

import { useActionState } from "react";

import { setMilestoneAction } from "./actions";

/**
 * 图鉴里程碑的两个旋钮：每集齐几种发一次、发多少。
 *
 * 为什么要可配：默认值是按达标线算的（0.8 天工资），达标线 18 时就是 14 阳光。
 * 家长看到「集齐 8 个新种类才 14」会觉得低——而这是个价值判断，
 * 不该由一个写死的倍数替他做。
 *
 * 留空 = 跟着达标线自动走。这个默认行为有意义：达标线一改，
 * 奖励力度自动跟上，不用记得回来手动调。
 */
export function MilestoneForm({
  childName,
  bonus,
  step,
  autoBonus,
  autoStep,
}: {
  childName: string;
  /** 已固定的值，null = 没固定 */
  bonus: number | null;
  step: number | null;
  /** 不固定时系统会用的值，显示在占位符里让家长知道基线在哪 */
  autoBonus: number;
  autoStep: number;
}) {
  const [error, formAction, isPending] = useActionState(setMilestoneAction, null);

  return (
    <form action={formAction} className="pixel-card flex flex-col gap-2 bg-white p-4">
      <h2 className="font-semibold">{childName} 的图鉴里程碑</h2>
      <p className="text-sm text-slate-500">
        每集齐一定数量的<b>不同种类</b>宝可梦，发一次奖励。
        <b>两个都留空</b>就跟着每日达标线自动算（现在是每 {autoStep} 种发 {autoBonus} 阳光）；
        填了就固定住，达标线再变也不动。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">每</span>
        <input
          name="step"
          type="number"
          min={1}
          defaultValue={step ?? ""}
          placeholder={String(autoStep)}
          className="w-24 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <span className="text-sm text-slate-600">个不同种类，奖励</span>
        <input
          name="bonus"
          type="number"
          min={1}
          defaultValue={bonus ?? ""}
          placeholder={String(autoBonus)}
          className="w-28 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <span className="text-sm text-slate-600">阳光</span>
        <button
          type="submit"
          disabled={isPending}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存"}
        </button>
      </div>

      {error && <p className="text-sm text-nes-red">{error}</p>}

      <p className="text-sm text-slate-500">
        调高之前先看一眼「经济体检」：里程碑给太多的话，孩子扔球刷里程碑就能净赚阳光，
        打卡这件事本身就失去意义了。体检会算出上限并拦住。
      </p>
    </form>
  );
}
