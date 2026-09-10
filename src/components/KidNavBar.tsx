import Link from "next/link";

import { Pinyin } from "@/components/Pinyin";

/** 底部导航按钮的配色。key 对应 8-bit 主题里的几个色板。 */
const TONE_CLASS = {
  sky: "bg-nes-sky",
  green: "bg-nes-green",
  pink: "bg-nes-pink",
} as const;

export type KidNavItem = {
  href: string;
  /** 按钮上的中文，会自动标拼音 */
  label: string;
  emoji: string;
  tone: keyof typeof TONE_CLASS;
};

/**
 * 孩子端每一页底部的那排按钮。统一放在这里有两个原因：
 *  1. 四个页面的底部按钮样式本来是各写各的，很容易改歪；
 *  2. 漂浮动画要靠"相邻按钮错开半个周期"才好看，交给组件按下标自动分配，
 *     页面就不用手动记得给第二个按钮加 animate-delay-half。
 *
 * compact：首页要把整页塞进一屏，按钮矮一点；其它页面可以滚动，用大一号的。
 */
export function KidNavBar({
  items,
  compact = false,
}: {
  items: KidNavItem[];
  compact?: boolean;
}) {
  const size = compact ? "py-2 text-lg lg:py-3 lg:text-2xl" : "px-6 py-3 text-xl lg:py-4 lg:text-2xl";

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <div className="flex gap-2 lg:gap-3">
        {items.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            // 奇数位的按钮把动画起点往前拨半个周期，两个按钮就一上一下交替漂浮。
            className={`pixel-btn kid-text animate-bounce-slow ${
              i % 2 === 1 ? "animate-delay-half" : ""
            } flex flex-1 items-center justify-center gap-2 text-white ${TONE_CLASS[item.tone]} ${size}`}
          >
            {item.emoji} <Pinyin text={item.label} />
          </Link>
        ))}
      </div>

      {/*
        家长出口。没有它的话，勾了"这是孩子的设备"之后就出不去了——
        / 和 /admin 都会被弹回 /kid，孩子端又没有任何登录入口，
        只能手输 /login 才能脱身（家长自己在手机上误勾一次就懵了）。

        做得很小、很淡是故意的：这是给家长的逃生口，不该在孩子的平板上抢注意力。
        孩子点了也没关系——落到登录页，没有密码什么都做不了。
      */}
      <a
        href="/login"
        className="self-end text-xs text-white/50 hover:text-white/90"
        title="家长在这里登录，可以切回后台"
      >
        家长登录 →
      </a>
    </div>
  );
}
