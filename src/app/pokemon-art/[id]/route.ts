import { upstreamArtUrl } from "@/lib/pokemonArt";

/**
 * 宝可梦立绘代理。浏览器请求 /pokemon-art/25，这里去上游取图再转出来。
 *
 * 存在的理由见 lib/pokemonArt.ts：官方立绘托管在 raw.githubusercontent.com，
 * 国内访问不了，孩子那边图片全是裂的。
 *
 * 不放在 public/ 里自带一份：那等于把任天堂的美术资源复制进这个仓库，
 * 而这个仓库是要上公网、还要给朋友注册用的。代理只是转发，不在仓库里留副本。
 */

/** 全国图鉴目前 1025 只，留点余量；上限主要是防止有人拿它当任意 URL 转发器。 */
const MAX_SPECIES_ID = 1300;

/** 图片按 id 永远不变，可以放心让浏览器和 CDN 长期缓存。 */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // id 来自路径，是完全不可信的输入。只放行纯数字且在合理范围内的，
  // 否则就能用它去请求任意地址（SSRF）。
  const speciesId = Number(id);
  if (!Number.isInteger(speciesId) || speciesId < 1 || speciesId > MAX_SPECIES_ID) {
    return new Response("Not found", { status: 404 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamArtUrl(speciesId), {
      // Next 的 fetch 缓存对二进制大响应意义不大，缓存交给下面的 Cache-Control 和 CDN
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // 上游抽风时不要 500——页面上一张裂图好过整页报错
    return new Response("Upstream unavailable", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
