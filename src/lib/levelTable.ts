/**
 * 等级表和纯计算。**故意不 import 任何东西**。
 *
 * 和 lib/rarity.ts 同样的理由：lib/level.ts 里有读库的函数，链式依赖 Prisma Client，
 * 而客户端组件（家长端的礼物表单要选"几级解锁"）只要从那边取一个常量，
 * 就会把整个 Prisma 运行时拖进浏览器包、直接构建失败。
 * 纯数据放这里，服务端和客户端都能安全引用。
 */

/**
 * 每一级需要累计挣到多少阳光，以及称号。
 *
 * 门槛用**绝对阳光数**而不是"几天工资"：累计值是历史量、日薪是当前量，
 * 用日薪换算的话家长加一门课会让所有门槛瞬间抬高，孩子眼看着"还差 300 升级"
 * 变成"还差 800"。绝对数字确实会随日薪漂移，但漂移方向是"涨薪之后升级更快"，
 * 这符合直觉，也符合"多干活就该多得"。
 *
 * 曲线按日薪 30 左右排的（每级大约 1.4~1.6 倍），跨度约四年：
 * Lv2 ≈ 5 天 / Lv5 ≈ 7 周 / Lv8 ≈ 7 个月 / Lv12 ≈ 2.3 年 / Lv15 ≈ 5 年。
 */
export const LEVELS: { need: number; title: string }[] = [
  { need: 0, title: "打卡新手" },
  { need: 150, title: "小小坚持者" },
  { need: 400, title: "习惯养成中" },
  { need: 800, title: "打卡小能手" },
  { need: 1500, title: "自律小达人" },
  { need: 2600, title: "坚持之星" },
  { need: 4200, title: "毅力高手" },
  { need: 6500, title: "百日达人" },
  { need: 9500, title: "自律大师" },
  { need: 13500, title: "时间管理者" },
  { need: 18500, title: "习惯守护者" },
  { need: 25000, title: "长跑冠军" },
  { need: 33000, title: "自律传奇" },
  { need: 43000, title: "不动如山" },
  { need: 55000, title: "终极自律者" },
];

export const MAX_LEVEL = LEVELS.length;

export function levelTitle(level: number): string {
  return LEVELS[Math.min(Math.max(level, 1), MAX_LEVEL) - 1].title;
}

/** 按累计阳光算出该在第几级。 */
export function levelForEarned(earned: number): number {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (earned >= LEVELS[i].need) level = i + 1;
  }
  return level;
}

export type LevelProgress = {
  level: number;
  title: string;
  earned: number;
  /** 当前这一级的起点 */
  from: number;
  /** 下一级的门槛。已经满级就是 null */
  next: number | null;
  /** 距离下一级还差多少。满级为 0 */
  remaining: number;
  /** 当前这一级走了百分之多少，0~1。满级为 1 */
  ratio: number;
};

export function levelProgress(level: number, earned: number): LevelProgress {
  const from = LEVELS[Math.min(level, MAX_LEVEL) - 1].need;
  const next = level >= MAX_LEVEL ? null : LEVELS[level].need;
  return {
    level,
    title: levelTitle(level),
    earned,
    from,
    next,
    remaining: next === null ? 0 : Math.max(0, next - earned),
    ratio: next === null ? 1 : Math.min(1, (earned - from) / (next - from)),
  };
}

