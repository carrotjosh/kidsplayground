import { prisma } from "@/lib/db";

/**
 * 进化链查询。
 *
 * 数据是两个 id（evolutionChainId / evolvesFromId，见 prisma schema），
 * 这里把它们还原成一棵树。为什么是树不是链：伊布一只能进化成八种，
 * 妙蛙种子那种单线只是特例，按链表画的话伊布会显示错。
 */

export type EvolutionNode = {
  id: number;
  nameZh: string;
  types: string[];
  rarity: number;
  /** 从这一只进化出来的（可能有多只，比如伊布） */
  next: EvolutionNode[];
};

export type EvolutionChain = {
  /** 整条链从头开始的树。链上只有它自己时返回 null——一只孤零零的"进化路径"没有信息量 */
  root: EvolutionNode | null;
  /** 链上一共几只，页面用来决定要不要显示这一块 */
  size: number;
};

/**
 * 取某只宝可梦所在的整条进化链。
 *
 * 只查**已经灌进库的**那些（目前是前三世代 386 只）。跨代进化会因此断掉一截，
 * 比如皮丘（172，二代）→ 皮卡丘（25，一代）在只灌了一代时会缺一环。
 * 这是刻意的取舍：显示一只库里没有、孩子也永远遇不到的宝可梦更让人困惑。
 */
export async function getEvolutionChain(speciesId: number): Promise<EvolutionChain> {
  const self = await prisma.pokemonSpecies.findUnique({
    where: { id: speciesId },
    select: { evolutionChainId: true },
  });
  if (!self?.evolutionChainId) return { root: null, size: 0 };

  const members = await prisma.pokemonSpecies.findMany({
    where: { evolutionChainId: self.evolutionChainId },
    select: { id: true, nameZh: true, types: true, rarity: true, evolvesFromId: true },
    orderBy: { id: "asc" },
  });
  if (members.length <= 1) return { root: null, size: members.length };

  const byId = new Map(members.map((m) => [m.id, m]));
  const nodes = new Map<number, EvolutionNode>(
    members.map((m) => [
      m.id,
      { id: m.id, nameZh: m.nameZh, types: m.types, rarity: m.rarity, next: [] },
    ])
  );

  let root: EvolutionNode | null = null;
  for (const m of members) {
    const node = nodes.get(m.id)!;
    // 上一级不在库里（跨代进化被截断）时，把这一只当成根，而不是让整条链没有根
    const parent = m.evolvesFromId ? nodes.get(m.evolvesFromId) : undefined;
    if (parent) parent.next.push(node);
    else if (!root || (m.evolvesFromId === null && byId.has(m.id))) root ??= node;
  }

  return { root: root ?? nodes.get(speciesId) ?? null, size: members.length };
}

/** 把树压成"一层一层"的列表，页面按层横向排就是一条进化路径。 */
export function flattenByDepth(root: EvolutionNode | null): EvolutionNode[][] {
  if (!root) return [];
  const levels: EvolutionNode[][] = [];
  let current = [root];
  while (current.length > 0) {
    levels.push(current);
    current = current.flatMap((n) => n.next);
  }
  return levels;
}
