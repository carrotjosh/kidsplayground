import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // chinese-days 的 package.json 写着 type: "commonjs"，但 module 字段指向的 dist/index.es.js
  // 是 ESM 语法，打包器会因为格式冲突报错。放进 serverExternalPackages 让 Node 在运行时
  // 直接 require 它的 CJS 入口，绕开这个不一致（只在服务端用到，不影响前端体积）。
  serverExternalPackages: ["chinese-days"],
};

export default nextConfig;
