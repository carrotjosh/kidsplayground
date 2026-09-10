// 同样只取类型：这个文件可能被客户端组件引用，
// 引 Prisma Client 的运行时值会把整个 Prisma 拖进浏览器包。
import type { KidTheme } from "@/generated/prisma/client";

import type { KidNavItem } from "@/components/KidNavBar";

/**
 * 主题相关的展示配置集中在这里，免得"图鉴还是花园"这个判断散落在各个页面里。
 * 加第三个主题时，改这一个文件 + 加一条路由就够了。
 */
export const THEME_META: Record<
  KidTheme,
  { label: string; emoji: string; path: string; adminLabel: string; adminPath: string }
> = {
  GARDEN: {
    label: "我的花园",
    emoji: "🌻",
    path: "garden",
    adminLabel: "植物目录",
    adminPath: "/admin/plants",
  },
  POKEDEX: {
    label: "我的图鉴",
    emoji: "📕",
    path: "pokedex",
    adminLabel: "精灵球",
    adminPath: "/admin/balls",
  },
};

/** 孩子端底部导航里"收藏玩法"那个按钮，按主题给不同的入口。 */
export function collectionNavItem(theme: KidTheme, slug: string): KidNavItem {
  const meta = THEME_META[theme];
  return { href: `/kid/${slug}/${meta.path}`, label: meta.label, emoji: meta.emoji, tone: "green" };
}
