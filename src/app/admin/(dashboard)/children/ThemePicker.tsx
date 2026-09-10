"use client";

// 只 import type：KidTheme 那个**值**来自 Prisma Client，在客户端组件里引用它
// 会把整个 Prisma 运行时拖进浏览器包（它要 node:module，直接构建失败）。
// 类型在编译期就擦掉了，值这里用字符串字面量即可。
import type { KidTheme } from "@/generated/prisma/client";

import { setThemeAction } from "./actions";

const OPTIONS: { theme: KidTheme; emoji: string; name: string; desc: string }[] = [
  {
    theme: "GARDEN",
    emoji: "🌻",
    name: "植物大战僵尸",
    desc: "阳光买植物种进 4×4 的花园；任务没完成，当晚僵尸会吃掉一棵；每种种满 4 棵集齐一套，连本带利换回 1.5 倍阳光。",
  },
  {
    theme: "POKEDEX",
    emoji: "📕",
    name: "宝可梦图鉴",
    desc: "阳光买精灵球去抓宝可梦，球越好越容易遇到并抓住稀有的；任务没完成，会有一只离家出走；每集齐 8 种奖励阳光。",
  },
];

/**
 * 一个孩子同时只跑一个主题：阳光全投在一处，经济才不会被摊薄，
 * "任务没完成"的惩罚也只作用于一边。切换随时可以，两边的数据都保留着。
 */
export function ThemePicker({ current, childName }: { current: KidTheme; childName: string }) {
  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-4">
      <h2 className="font-semibold">{childName} 的玩法主题</h2>
      <p className="text-sm text-slate-500">
        一次只能玩一个。切换之后另一边的东西不会丢，切回来还在。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const active = opt.theme === current;
          return (
            <form key={opt.theme} action={setThemeAction.bind(null, opt.theme)}>
              <button
                type="submit"
                disabled={active}
                className={`pixel-card flex h-full w-full flex-col gap-2 p-4 text-left ${
                  active ? "cursor-default bg-amber-50" : "bg-white hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className="text-2xl">{opt.emoji}</span>
                  {opt.name}
                  {active && <span className="text-xs text-nes-green">当前使用中</span>}
                </span>
                <span className="text-sm text-slate-500">{opt.desc}</span>
                {!active && <span className="text-sm text-nes-red">点这里切换 →</span>}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
