/**
 * 从 PokéAPI 把第一世代 151 只宝可梦灌进 PokemonSpecies 表。
 *
 * 用法：npm run db:seed-pokedex
 *
 * 只需要跑一次。PokemonSpecies 是**全局参考数据**，不属于任何租户，所有孩子共享；
 * 抓到的时候会把这里的字段整份快照进 Caught，所以之后这张表变了、
 * 甚至 PokéAPI 挂了，都不影响已经抓到的宝可梦怎么显示。
 *
 * 关于立绘：这里只存 URL，图片实际托管在 PokeAPI 的 GitHub 仓库上，
 * 我们不往自己的仓库里存副本（官方立绘的版权是任天堂/宝可梦公司的）。
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";

const GEN1_COUNT = 151;
const API = "https://pokeapi.co/api/v2";

/** 简单的内存缓存 + 串行请求：特性和技能会被大量species 复用，不缓存要多打好几百次。 */
const cache = new Map<string, unknown>();
async function get<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const json = await res.json();
  cache.set(url, json);
  return json as T;
}

type Named = { name: string; url: string };
type LocalizedName = { name: string; language: { name: string } };

/** PokéAPI 的中文有 zh-hans（简体）和 zh-hant（繁体），优先简体，都没有就退回英文。 */
function zh(names: LocalizedName[] | undefined, fallback: string): string {
  if (!names) return fallback;
  return (
    names.find((n) => n.language.name === "zh-hans")?.name ??
    names.find((n) => n.language.name === "zh-hant")?.name ??
    fallback
  );
}

/**
 * 稀有度按**能力总和**分档，不用 PokéAPI 的 capture_rate。
 * capture_rate 表达的是原作里的抓取难度，妙蛙种子是 45，会被误判成传说；
 * 而孩子的原话是"属性越厉害越稀有"，能力总和才是这个意思。
 */
function rarityOf(statTotal: number, legendary: boolean): number {
  if (legendary || statTotal >= 570) return 4; // 传说
  if (statTotal >= 480) return 3; // 稀有
  if (statTotal >= 390) return 2; // 少见
  return 1; // 普通
}

/**
 * 挑一个"招牌技能"：**优先本系技能**里威力最高的那个。
 *
 * 一开始只取"威力最高"，结果全是通用招式机——妙蛙种子和皮卡丘都是火箭头锤、
 * 卡比兽和超梦都是破坏光线，一点特色都没有。按属性过滤之后皮卡丘才会拿到电系招式。
 * 完全没有本系伤害技的（百变怪只会变身）退回全局最高威力，再没有就用撞击兜底。
 */
async function pickSignatureMove(moves: { move: Named }[], types: string[]) {
  let bestSameType: { name: string; power: number } | null = null;
  let bestAny: { name: string; power: number } | null = null;

  for (const m of moves) {
    const detail = await get<{ power: number | null; type: Named; names: LocalizedName[] }>(
      m.move.url
    );
    if (!detail.power) continue;
    const entry = { name: zh(detail.names, m.move.name), power: detail.power };

    if (!bestAny || entry.power > bestAny.power) bestAny = entry;
    if (types.includes(detail.type.name) && (!bestSameType || entry.power > bestSameType.power)) {
      bestSameType = entry;
    }
  }
  return bestSameType ?? bestAny ?? { name: "撞击", power: 40 };
}

async function main() {
  console.log(`从 PokéAPI 拉第一世代 ${GEN1_COUNT} 只...`);
  const rows = [];

  for (let id = 1; id <= GEN1_COUNT; id++) {
    const p = await get<{
      name: string;
      types: { type: Named }[];
      stats: { base_stat: number; stat: Named }[];
      abilities: { ability: Named }[];
      moves: { move: Named }[];
      sprites: { other: { "official-artwork": { front_default: string | null } } };
    }>(`${API}/pokemon/${id}`);

    const s = await get<{
      names: LocalizedName[];
      gender_rate: number;
      is_legendary: boolean;
      is_mythical: boolean;
    }>(`${API}/pokemon-species/${id}`);

    const stat = (key: string) => p.stats.find((x) => x.stat.name === key)?.base_stat ?? 0;
    const statTotal = p.stats.reduce((sum, x) => sum + x.base_stat, 0);
    const legendary = s.is_legendary || s.is_mythical;

    // 特性名也要中文，每个特性单独一个接口（有缓存，重复的不会重复打）
    const abilities: string[] = [];
    for (const a of p.abilities) {
      const detail = await get<{ names: LocalizedName[] }>(a.ability.url);
      abilities.push(zh(detail.names, a.ability.name));
    }

    const types = p.types.map((t) => t.type.name);
    const move = await pickSignatureMove(p.moves, types);

    rows.push({
      id,
      nameZh: zh(s.names, p.name),
      nameEn: p.name,
      types,
      hp: stat("hp"),
      attack: stat("attack"),
      defense: stat("defense"),
      spAtk: stat("special-attack"),
      spDef: stat("special-defense"),
      speed: stat("speed"),
      statTotal,
      rarity: rarityOf(statTotal, legendary),
      genderRate: s.gender_rate,
      isLegendary: legendary,
      abilities,
      moveName: move.name,
      movePower: move.power,
      artUrl:
        p.sprites.other["official-artwork"].front_default ??
        `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
    });

    if (id % 25 === 0) console.log(`  ${id}/${GEN1_COUNT}...`);
  }

  // upsert 而不是 createMany：重复跑要能覆盖更新（比如以后调了稀有度公式）
  for (const row of rows) {
    await prisma.pokemonSpecies.upsert({ where: { id: row.id }, update: row, create: row });
  }

  const byRarity = await prisma.pokemonSpecies.groupBy({
    by: ["rarity"],
    _count: { _all: true },
    orderBy: { rarity: "asc" },
  });
  const LABEL = ["", "普通", "少见", "稀有", "传说"];
  console.log(`\n写入 ${rows.length} 只：`);
  for (const g of byRarity) console.log(`  ${LABEL[g.rarity]} ${g._count._all} 只`);
  console.log(`\n随手挑一个立绘链接，拿国内网络的手机打开试试能不能显示：`);
  console.log(`  ${rows[24].nameZh} → ${rows[24].artUrl}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
