import type { ReactNode } from "react";

/**
 * 孩子端所有页面共用的外框。
 *
 * **为什么要有这一层**：原来每个页面自己写 `<main className="...">`，
 * 复制粘贴之后各自漂移——统计过一轮，九个页面长出了四种宽度上限
 * （首页和日历没有上限、单日和等级 max-w-4xl、花园图鉴礼物 max-w-5xl、
 * 全部宝可梦 max-w-6xl）。孩子在页面之间跳来跳去，内容区一会儿铺满一会儿两边留白，
 * 很跳戏。把外框收到 layout 里，页面就没机会再漂了。
 *
 * **不设 max-w**：孩子端跑在平板上，横屏时能铺满整屏才不浪费。
 * 这也是首页原本的行为，现在推广到所有页面。
 *
 * **h-dvh + overflow-hidden**：整页不滚动（平板触屏上整页滚很容易误触，
 * 而且滚下去之后底部导航就看不见了）。每个页面内部**必须**有一个
 * `min-h-0 flex-1 overflow-y-auto` 的伸缩区来吸收多余内容——
 * 没有的话内容超屏会被从底部裁掉，连同导航一起。
 * 这条由 `npm run check:layout` 把关。
 */
export default function KidLayout({ children }: { children: ReactNode }) {
  return (
    <main className="pixel-sky-bg flex h-dvh w-full flex-col gap-3 overflow-hidden p-3 sm:p-4 lg:gap-4 lg:p-6">
      {children}
    </main>
  );
}
