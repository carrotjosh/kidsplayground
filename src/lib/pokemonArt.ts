/**
 * 宝可梦立绘的地址。
 *
 * 为什么要绕一层自己的域名，而不是直接外链官方立绘：
 * 立绘托管在 raw.githubusercontent.com（PokeAPI/sprites 仓库），**国内访问不了**——
 * 实测孩子和朋友那边图片全是裂的，图鉴主题直接废掉。jsDelivr 那几个镜像也不保险。
 *
 * 浏览器改成访问 /pokemon-art/<id>，由服务端去取上游再转出来。
 * 前提条件（应用域名本身可达）本来就必须成立，所以这条路一定通。
 * 图片按 id 永远不变，所以缓存头开 immutable + 一年，上游每张只会被取一次。
 *
 * 这个文件**不能有服务端依赖**：客户端组件（EncounterBoard）也要用它拼地址。
 */

/** 浏览器用的地址。 */
export function pokemonArtPath(speciesId: number): string {
  return `/pokemon-art/${speciesId}`;
}

/**
 * 服务端去哪儿取原图。可以用环境变量换镜像——万一哪天 GitHub 连服务器也取不到，
 * 换成 jsDelivr 之类的镜像只改这一个变量，不用动数据库里存的快照。
 */
export function upstreamArtUrl(speciesId: number): string {
  const base =
    process.env.POKEMON_ART_BASE ??
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";
  return `${base}/${speciesId}.png`;
}
