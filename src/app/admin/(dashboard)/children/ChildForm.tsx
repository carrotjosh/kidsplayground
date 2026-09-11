"use client";

import { useActionState } from "react";

import { THEME_CHOICES } from "@/lib/theme";

import { createChildAction } from "./actions";

/**
 * 新增孩子。名字和玩法主题一起填。
 *
 * 主题原来要等档案建完、在下面的「玩法主题」卡片里才能改，新家长根本发现不了——
 * 默认落在花园主题，等孩子说"我想抓宝可梦"才回来找。建档时就问，一步到位。
 */
export function ChildForm({ isFirst }: { isFirst: boolean }) {
  const [error, formAction, isPending] = useActionState(createChildAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4 pixel-card bg-white p-5">
      <h2 className="font-semibold">{isFirst ? "先给孩子建个档案" : "新增孩子"}</h2>
      <p className="text-sm text-slate-500">
        建好之后会自动配上一套默认的任务模板、礼物和玩法道具，可以直接开始用，也可以再去各页面改。
      </p>

      <input
        name="name"
        placeholder="孩子的名字"
        required
        maxLength={20}
        className="w-full max-w-xs rounded-none border-2 border-nes-black px-3 py-2"
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">玩什么</legend>
        <p className="text-sm text-slate-500">
          一次只能玩一个——阳光全投在一处，经济才不会被摊薄。以后随时能换，两边的东西都留着。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {THEME_CHOICES.map((choice, i) => (
            <label key={choice.theme} className="cursor-pointer">
              {/* 用原生 radio + peer-checked 上色，不引入客户端状态 */}
              <input
                type="radio"
                name="theme"
                value={choice.theme}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col gap-2 border-2 border-slate-200 p-4 peer-checked:border-nes-black peer-checked:bg-amber-50">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="text-2xl">{choice.emoji}</span>
                  {choice.name}
                </span>
                <span className="text-sm text-slate-500">{choice.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "创建中..." : isFirst ? "创建档案，开始使用" : "新增孩子"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
