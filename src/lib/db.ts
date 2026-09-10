import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

// 不需要 ws polyfill：Neon 驱动走 WebSocket，而 Node 22+ 和 Cloudflare Workers 都内置了
// 全局 WebSocket。之前引 ws 是为了兼容老 Node，但它依赖 net/tls，在 Workers 上根本跑不起来。

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// 开发模式下 Next.js 热重载会反复执行模块顶层代码，用全局变量缓存单例，避免连接数暴涨。
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
