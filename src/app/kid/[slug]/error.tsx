"use client";

import { Ruby, type Annotated } from "@/components/Ruby";

/**
 * 孩子端的错误兜底。
 *
 * 用 div 不用 main：这个组件会被 [slug]/layout.tsx 的 <main> 包住，
 * 再套一层就是 <main> 里嵌 <main>，无效 HTML。
 * 外框（满屏、天空背景、内边距）已经由 layout 提供，这里只负责居中内容。
 */

// error.tsx 是 Next.js 强制要求的 "use client" 错误边界，拿不到父组件传参，
// 没法像 RefreshButton/EncounterBoard 那样"服务端预渲染 Annotated 再传进来"。
// 这两句文案是固定不变的，所以手算一次拼音直接硬编码，不在这里调用 annotate()——
// 那会把 pinyin-pro 的整本字典拖进客户端包，构建会崩（Pinyin.tsx 的注释写过这条坑）。
// 文案改了要重新跑一遍：
//   npx tsx -e 'import { annotate } from "./src/lib/pinyin"; console.log(JSON.stringify(annotate("新文案")))'
// 另外这个文件用的是 Ruby 不是 Pinyin，scripts/check-pinyin.ts 的
// grep -rl 'Pinyin\|KidNavBar' 扫不到它，这两句拼音对不对目前全靠手工核对。
const ERROR_MESSAGE: Annotated = [
  { c: "出", r: "chū" },
  { c: "了", r: "le" },
  { c: "点", r: "diǎn" },
  { c: "小", r: "xiǎo" },
  { c: "问", r: "wèn" },
  { c: "题", r: "tí" },
  { c: "，", r: "" },
  { c: "再", r: "zài" },
  { c: "试", r: "shì" },
  { c: "一", r: "yí" },
  { c: "次", r: "cì" },
  { c: "吧", r: "ba" },
];
const RETRY_LABEL: Annotated = [
  { c: "重", r: "chóng" },
  { c: "试", r: "shì" },
];

export default function KidError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl">😵</p>
      <Ruby annotated={ERROR_MESSAGE} className="kid-title kid-text pixel-text-outline text-white" />
      <button onClick={reset} className="pixel-btn kid-body bg-nes-green px-6 py-3 text-white">
        <Ruby annotated={RETRY_LABEL} />
      </button>
    </div>
  );
}
