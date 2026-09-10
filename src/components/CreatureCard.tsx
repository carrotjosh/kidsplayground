import { Pinyin } from "@/components/Pinyin";
import type { Gender } from "@/generated/prisma/client";
import { RARITY_LABELS } from "@/lib/rarity";

/**
 * 宝可梦卡片，做成 PTCG 那种卡面：顶栏名字 + HP，中间立绘，下面属性/技能/特性，
 * 底部稀有度星级。卡框是我自己写的 CSS，没有用任何官方卡牌美术。
 *
 * 立绘是**外链** PokeAPI 托管在 GitHub 上的官方立绘（版权是任天堂/宝可梦公司的），
 * 仓库里不存副本。故意用原生 <img> 而不是 next/image：
 * next/image 会让我们自己的服务器去代理抓图再吐给浏览器，等于在服务端缓存了这些图，
 * 而且多绕一跳、还要配 remotePatterns。原生 img 是浏览器直连 GitHub，我们不碰图片。
 */

/** 每个属性一个颜色，沿用大家熟悉的那套配色，孩子一眼能认出来。 */
const TYPE_STYLE: Record<string, { label: string; className: string }> = {
  normal: { label: "一般", className: "bg-stone-400" },
  fire: { label: "火", className: "bg-orange-500" },
  water: { label: "水", className: "bg-blue-500" },
  electric: { label: "电", className: "bg-yellow-400 text-nes-black" },
  grass: { label: "草", className: "bg-green-500" },
  ice: { label: "冰", className: "bg-cyan-300 text-nes-black" },
  fighting: { label: "格斗", className: "bg-red-700" },
  poison: { label: "毒", className: "bg-purple-500" },
  ground: { label: "地面", className: "bg-amber-600" },
  flying: { label: "飞行", className: "bg-indigo-300 text-nes-black" },
  psychic: { label: "超能", className: "bg-pink-500" },
  bug: { label: "虫", className: "bg-lime-600" },
  rock: { label: "岩石", className: "bg-yellow-700" },
  ghost: { label: "幽灵", className: "bg-violet-700" },
  dragon: { label: "龙", className: "bg-indigo-600" },
  dark: { label: "恶", className: "bg-neutral-700" },
  steel: { label: "钢", className: "bg-slate-400" },
  fairy: { label: "妖精", className: "bg-pink-300 text-nes-black" },
};

/** 稀有度决定卡框配色，越稀有越扎眼。 */
const RARITY_FRAME: Record<number, string> = {
  1: "bg-slate-200",
  2: "bg-sky-200",
  3: "bg-violet-300",
  4: "bg-amber-300",
};

const GENDER_MARK: Record<Gender, string> = { MALE: "♂", FEMALE: "♀", UNKNOWN: "—" };
const GENDER_COLOR: Record<Gender, string> = {
  MALE: "text-blue-600",
  FEMALE: "text-pink-600",
  UNKNOWN: "text-slate-400",
};

export type CreatureCardData = {
  nameZh: string;
  types: string[];
  rarity: number;
  artUrl: string;
  gender: Gender;
  ability: string;
  moveName: string;
  movePower: number;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  isShiny: boolean;
};

export function CreatureCard({
  creature,
  faded = false,
  count,
  goal,
}: {
  creature: CreatureCardData;
  /** 离家出走的那些用灰掉的样式留在图鉴里，孩子看得到自己失去了什么 */
  faded?: boolean;
  /** 同一种抓到几只。牌库里按种类归组时传 */
  count?: number;
  /** 这一种攒够几只算收集完成。传了就在角标上显示 N/目标 */
  goal?: number;
}) {
  const frame = RARITY_FRAME[creature.rarity] ?? RARITY_FRAME[1];

  return (
    <div
      className={`pixel-card flex flex-col gap-1.5 p-2 ${frame} ${
        faded ? "opacity-40 grayscale" : ""
      } ${creature.isShiny ? "ring-4 ring-amber-400" : ""}`}
    >
      {/* 顶栏：名字 + HP */}
      <div className="flex items-baseline justify-between gap-1">
        <p className="kid-text truncate text-base text-slate-900">
          <Pinyin text={creature.nameZh} />
        </p>
        <span className="pixel-font shrink-0 text-[9px] text-nes-red">HP{creature.hp}</span>
      </div>

      {/* 立绘。白底让各种配色的宝可梦都看得清；aspect-square 保证一排卡片等高 */}
      <div className="relative flex aspect-square items-center justify-center border-2 border-nes-black bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- 见文件头：故意直连外部图床，不走 next/image 代理 */}
        <img
          src={creature.artUrl}
          alt={creature.nameZh}
          loading="lazy"
          className="h-full w-full object-contain p-1"
        />
        {creature.isShiny && (
          <span className="absolute right-0.5 top-0.5 text-sm" title="闪光个体">
            ✨
          </span>
        )}
        <span
          className={`absolute bottom-0.5 right-1 text-lg font-bold ${GENDER_COLOR[creature.gender]}`}
          title="性别"
        >
          {GENDER_MARK[creature.gender]}
        </span>
        {count !== undefined && (goal !== undefined || count > 1) && (
          <span
            className={`pixel-border absolute left-0.5 top-0.5 px-1 text-xs font-bold text-white ${
              goal !== undefined && count >= goal ? "bg-nes-green" : "bg-nes-red"
            }`}
            title={goal !== undefined ? `抓到 ${count} 只，集满 ${goal} 只有奖励` : `抓到 ${count} 只`}
          >
            {goal !== undefined ? `${count}/${goal}${count >= goal ? " ✓" : ""}` : `×${count}`}
          </span>
        )}
      </div>

      {/* 属性徽章 */}
      <div className="flex flex-wrap gap-1">
        {creature.types.map((t) => {
          const style = TYPE_STYLE[t] ?? { label: t, className: "bg-slate-500" };
          return (
            <span
              key={t}
              className={`kid-text border-2 border-nes-black px-1.5 text-xs text-white ${style.className}`}
            >
              {style.label}
            </span>
          );
        })}
      </div>

      {/* 招牌技能 */}
      <div className="flex items-baseline justify-between gap-1 border-t-2 border-nes-black/20 pt-1">
        <span className="kid-text truncate text-sm text-slate-800">{creature.moveName}</span>
        <span className="pixel-font shrink-0 text-[9px] text-nes-brown">{creature.movePower}</span>
      </div>

      <p className="kid-text truncate text-xs text-slate-600" title={creature.ability}>
        特性：{creature.ability}
      </p>

      {/* 稀有度星级 */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-500">{"★".repeat(creature.rarity)}</span>
        <span className="kid-text text-slate-500">{RARITY_LABELS[creature.rarity]}</span>
      </div>
    </div>
  );
}
