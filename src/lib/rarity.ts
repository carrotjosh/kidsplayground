/**
 * 稀有度的展示常量。**故意单独一个文件、不 import 任何东西**。
 *
 * lib/pokedex.ts 里有服务端逻辑，它链式依赖 lib/tasks → lib/holidays → chinese-days，
 * 而 chinese-days 在 serverExternalPackages 里、没法打进客户端包。客户端组件
 * （比如精灵球商店）只要从 pokedex.ts 里取一个常量，就会把整条链拖进浏览器构建、直接构建失败。
 * 把纯展示用的东西放这里，两边都能安全引用。
 */
export const RARITY_LABELS = ["", "普通", "少见", "稀有", "传说"] as const;
