import { headers } from "next/headers";

/**
 * 当前请求的站点地址（`https://例子.com`，不带结尾斜杠）。
 *
 * 用来把后台里显示的孩子端地址拼成**可以直接点开的全链接**——
 * 只写 `/kid/xxx` 的话家长没法复制给孩子的平板，也看不出该用哪个域名
 * （同一套系统现在有 vercel.app 和自定义域名两个入口）。
 *
 * 为什么在服务端读 header 而不是在浏览器里读 `window.location.origin`：
 * 客户端组件也会先在服务端渲染一遍，那时 `window` 是 undefined，
 * 渲染期去读就会 hydration 不一致；放进 useEffect 又会让链接第一帧是空的。
 * 请求头里本来就有这个信息，直接取最省事。
 *
 * proto 优先信 `x-forwarded-proto`（Vercel 和 Cloudflare 都会带上）。
 * 没有的话按 host 猜：局域网和本地开发跑的是 http，其它一律 https——
 * 猜错成 http 会让链接在公网上被降级，猜错成 https 会让本地链接直接打不开，
 * 后者更常见也更烦人，所以只对明显是本地的 host 放行 http。
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0") ||
    // 局域网自建部署：192.168.x.x / 10.x.x.x / 172.16–31.x.x
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);

  return `${forwarded ?? (isLocal ? "http" : "https")}://${host}`;
}
