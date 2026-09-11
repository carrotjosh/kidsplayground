/**
 * 宝可梦属性与克制表。**故意不 import 任何东西**（同 lib/rarity.ts、lib/levelTable.ts）。
 *
 * 为什么写死而不从 PokéAPI 取：这是一张十八乘十八的固定规则表，从第六世代起就没变过，
 * 不是"数据"而是"规则"。存进库要多两张表和一次灌库，每次渲染详情页还要多几次查询；
 * 而且 PokéAPI 的属性名根本没有简体中文（试过 zh-Hans，返回 undefined），
 * 中文名无论如何都得自己写。
 *
 * 表按**防守方**组织：给定这只宝可梦是什么属性，它怕什么、抗什么、免疫什么。
 * 这正好是孩子想知道的方向——"我这只怕什么"，而不是"我这只能打谁"。
 */

export const POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
] as const;

export type PokemonType = (typeof POKEMON_TYPES)[number];

const LABELS: Record<PokemonType, string> = {
  normal: "一般",
  fire: "火",
  water: "水",
  electric: "电",
  grass: "草",
  ice: "冰",
  fighting: "格斗",
  poison: "毒",
  ground: "地面",
  flying: "飞行",
  psychic: "超能力",
  bug: "虫",
  rock: "岩石",
  ghost: "幽灵",
  dragon: "龙",
  dark: "恶",
  steel: "钢",
  fairy: "妖精",
};

/** 属性配色，和原作那套约定俗成的颜色一致，孩子在别处见过就能对上。 */
const COLORS: Record<PokemonType, string> = {
  normal: "#9098a1",
  fire: "#e8743c",
  water: "#4d90d5",
  electric: "#eec21f",
  grass: "#63bb5b",
  ice: "#74cec0",
  fighting: "#ce4069",
  poison: "#aa6bc8",
  ground: "#d97845",
  flying: "#8fa8dd",
  psychic: "#f8737f",
  bug: "#90c12c",
  rock: "#c7b78b",
  ghost: "#5269ac",
  dragon: "#0a6dc4",
  dark: "#5a5366",
  steel: "#5a8ea1",
  fairy: "#ec8fe6",
};

export function typeLabel(type: string): string {
  return LABELS[type as PokemonType] ?? type;
}

export function typeColor(type: string): string {
  return COLORS[type as PokemonType] ?? "#9098a1";
}

/** 每个防守属性：受到哪些属性的攻击会翻倍 / 减半 / 完全无效。 */
const DEFENSE: Record<PokemonType, { weak: PokemonType[]; resist: PokemonType[]; immune: PokemonType[] }> = {
  normal: { weak: ["fighting"], resist: [], immune: ["ghost"] },
  fire: {
    weak: ["water", "ground", "rock"],
    resist: ["fire", "grass", "ice", "bug", "steel", "fairy"],
    immune: [],
  },
  water: { weak: ["electric", "grass"], resist: ["fire", "water", "ice", "steel"], immune: [] },
  electric: { weak: ["ground"], resist: ["electric", "flying", "steel"], immune: [] },
  grass: {
    weak: ["fire", "ice", "poison", "flying", "bug"],
    resist: ["water", "electric", "grass", "ground"],
    immune: [],
  },
  ice: { weak: ["fire", "fighting", "rock", "steel"], resist: ["ice"], immune: [] },
  fighting: { weak: ["flying", "psychic", "fairy"], resist: ["bug", "rock", "dark"], immune: [] },
  poison: {
    weak: ["ground", "psychic"],
    resist: ["grass", "fighting", "poison", "bug", "fairy"],
    immune: [],
  },
  ground: { weak: ["water", "grass", "ice"], resist: ["poison", "rock"], immune: ["electric"] },
  flying: {
    weak: ["electric", "ice", "rock"],
    resist: ["grass", "fighting", "bug"],
    immune: ["ground"],
  },
  psychic: { weak: ["bug", "ghost", "dark"], resist: ["fighting", "psychic"], immune: [] },
  bug: { weak: ["fire", "flying", "rock"], resist: ["grass", "fighting", "ground"], immune: [] },
  rock: {
    weak: ["water", "grass", "fighting", "ground", "steel"],
    resist: ["normal", "fire", "poison", "flying"],
    immune: [],
  },
  ghost: { weak: ["ghost", "dark"], resist: ["poison", "bug"], immune: ["normal", "fighting"] },
  dragon: { weak: ["ice", "dragon", "fairy"], resist: ["fire", "water", "electric", "grass"], immune: [] },
  dark: { weak: ["fighting", "bug", "fairy"], resist: ["ghost", "dark"], immune: ["psychic"] },
  steel: {
    weak: ["fire", "fighting", "ground"],
    resist: [
      "normal",
      "grass",
      "ice",
      "flying",
      "psychic",
      "bug",
      "rock",
      "dragon",
      "steel",
      "fairy",
    ],
    immune: ["poison"],
  },
  fairy: { weak: ["poison", "steel"], resist: ["fighting", "bug", "dark"], immune: ["dragon"] },
};

export type Matchup = { type: PokemonType; label: string; multiplier: number };

/**
 * 算这只宝可梦（可能是双属性）分别怕什么、抗什么。
 *
 * 双属性要把两边的倍率**相乘**，所以会出现 4 倍和 0.25 倍——
 * 比如草/地面的实际是 4 倍怕冰。孩子玩久了会自己发现这件事，
 * 所以不能只显示两边各自的弱点，必须真的乘出来。
 */
export function typeMatchups(types: string[]): { weak: Matchup[]; resist: Matchup[] } {
  const own = types.filter((t): t is PokemonType => t in DEFENSE);
  const multiplier = new Map<PokemonType, number>();

  for (const attacking of POKEMON_TYPES) {
    let m = 1;
    for (const defending of own) {
      const rel = DEFENSE[defending];
      if (rel.immune.includes(attacking)) m = 0;
      else if (rel.weak.includes(attacking)) m *= 2;
      else if (rel.resist.includes(attacking)) m *= 0.5;
    }
    if (m !== 1) multiplier.set(attacking, m);
  }

  const entries = [...multiplier.entries()].map(([type, m]) => ({
    type,
    label: LABELS[type],
    multiplier: m,
  }));

  return {
    // 倍率高的排前面：孩子最需要先知道"最怕的是哪个"
    weak: entries.filter((e) => e.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier),
    resist: entries.filter((e) => e.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier),
  };
}

/** 把 0.25 / 0.5 / 2 / 4 显示成孩子看得懂的样子。 */
export function multiplierLabel(m: number): string {
  if (m === 0) return "完全没用";
  if (m === 0.25) return "很不怕";
  if (m === 0.5) return "不太怕";
  if (m === 2) return "怕";
  if (m === 4) return "非常怕";
  return `${m} 倍`;
}
