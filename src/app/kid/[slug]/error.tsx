"use client";

/**
 * 孩子端的错误兜底。
 *
 * 用 div 不用 main：这个组件会被 [slug]/layout.tsx 的 <main> 包住，
 * 再套一层就是 <main> 里嵌 <main>，无效 HTML。
 * 外框（满屏、天空背景、内边距）已经由 layout 提供，这里只负责居中内容。
 */
export default function KidError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-5xl">😵</p>
      <p className="kid-title kid-text pixel-text-outline text-white">出了点小问题，再试一次吧</p>
      <button onClick={reset} className="pixel-btn kid-body bg-nes-green px-6 py-3 text-white">
        重试
      </button>
    </div>
  );
}
