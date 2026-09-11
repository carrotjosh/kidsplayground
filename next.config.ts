import type { NextConfig } from "next";

/**
 * Server Action 的 CSRF 校验会把请求的 Origin 和 Host 比对，对不上就拒绝。
 * 通过隧道/反代访问时（Cloudflare Tunnel、ngrok 等），浏览器发的 Origin 是隧道域名，
 * 而应用自己以为的 Host 是 localhost，两者不一致 —— 结果是页面能打开，但**所有按钮都失效**
 * （提交打卡、兑换、切孩子……全部报 Invalid Server Actions request）。
 *
 * 把隧道域名放进 allowedOrigins 就能放行。用环境变量而不是写死在这里：
 * 快速隧道的域名每次重启都会变，而且这只是临时测试用的白名单，不该跟着代码进生产。
 *
 * 用法（逗号分隔，支持通配符）：
 *   ALLOWED_ORIGINS="*.trycloudflare.com" npm start
 */
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  // chinese-days 的 package.json 写着 type: "commonjs"，但 module 字段指向的 dist/index.es.js
  // 是 ESM 语法，打包器会因为格式冲突报错。放进 serverExternalPackages 让 Node 在运行时
  // 直接 require 它的 CJS 入口，绕开这个不一致（只在服务端用到，不影响前端体积）。
  serverExternalPackages: ["chinese-days"],

  // 关掉开发模式左下角那个圆形指示器。孩子端是锁死一屏的布局，
  // 那个圆圈正好压在底部导航上，调布局时分不清"这块是写歪了还是被它挡了"。
  //
  // 注意它**关不掉 Next DevTools 面板**（那个带 Close 按钮的浮层是另一套，
  // Next 16 没有提供配置项关闭）。不过 devtools 只在 next dev 注入，
  // 生产构建里一处都没有——实测 next start 的页面里 next-devtools 出现 0 次。
  devIndicators: false,

  ...(allowedOrigins.length > 0
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
};

export default nextConfig;
