// 同样只取类型：这个文件可能被客户端组件引用，
// 引 Prisma Client 的运行时值会把整个 Prisma 拖进浏览器包。
import type { KidTheme } from "@/generated/prisma/client";

import type { KidNavItem } from "@/components/KidNavBar";

/**
 * 主题相关的展示配置集中在这里，免得"图鉴还是花园"这个判断散落在各个页面里。
 * 加第三个主题时，改这一个文件 + 加一条路由就够了。
 *
 * adminLabel 是家长端导航里那一栏的名字。刻意叫「花园」「宝可梦」而不是
 * 「植物目录」「精灵球」——那一页现在既是孩子的游戏进展、也是目录，
 * 家长想看"孩子玩到哪了"第一反应会点玩法的名字，不会点"目录"。
 */
export const THEME_META: Record<
  KidTheme,
  { label: string; emoji: string; path: string; adminLabel: string; adminPath: string }
> = {
  GARDEN: {
    label: "我的花园",
    emoji: "🌻",
    path: "garden",
    adminLabel: "花园",
    adminPath: "/admin/plants",
  },
  POKEDEX: {
    label: "我的图鉴",
    emoji: "📕",
    path: "pokedex",
    adminLabel: "宝可梦",
    adminPath: "/admin/balls",
  },
};

/**
 * 给家长挑主题时看的说明。
 *
 * 放这里而不是各写各的：建档表单和「孩子档案」里的切换器都要用同一套文案，
 * 分成两份的话改了一处忘了另一处，家长会在两个地方看到不一样的说明。
 */
export const THEME_CHOICES: { theme: KidTheme; emoji: string; name: string; desc: string }[] = [
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
    desc: "阳光买精灵球去抓宝可梦，球越好越容易遇到并抓住稀有的；任务没完成，会有一只离家出走；每集齐 8 种奖励阳光，同一种攒够数量还有额外奖励。",
  },
];

/** 孩子端底部导航里"收藏玩法"那个按钮，按主题给不同的入口。 */
export function collectionNavItem(theme: KidTheme, slug: string): KidNavItem {
  const meta = THEME_META[theme];
  return { href: `/kid/${slug}/${meta.path}`, label: meta.label, emoji: meta.emoji, tone: "green" };
}
