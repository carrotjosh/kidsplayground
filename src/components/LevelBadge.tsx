import Link from "next/link";

import { Pinyin } from "@/components/Pinyin";
import type { LevelProgress } from "@/lib/levelTable";

/**
 * 等级徽章。和 PointsBadge 并排放在孩子端顶部。
 *
 * 除了级数还画一条到下一级的进度——只显示"Lv.3"的话，等级就只是个静态标签；
 * 有进度条才会让孩子知道"再打几次卡就升了"，这才是它作为长期动力的用处。
 *
 * 整块是「等级之路」的入口：锁着的道具必须配一张看得见的路线图，
 * 否则孩子感受到的只是"东西少了"，而不是"再努力一点就有了"。
 */
export function LevelBadge({ progress, href }: { progress: LevelProgress; href: string }) {
  return (
    <Link
      href={href}
      className="pixel-card flex h-full items-center gap-3 bg-nes-green px-4 py-2 transition hover:brightness-110 lg:gap-4 lg:px-5 lg:py-3"
    >
      <span className="text-3xl leading-none lg:text-4xl">🏅</span>
      <div className="min-w-20 lg:min-w-28">
        <p className="pixel-font pixel-text-outline text-lg text-white lg:text-2xl">
          Lv.{progress.level}
        </p>
        <p className="kid-text text-[11px] leading-tight text-white lg:text-sm">
          <Pinyin text={progress.title} />
        </p>
        {/* 满级就不画进度条了，画一条永远满的反而像卡住了 */}
        {progress.next !== null && (
          <div className="mt-1 h-1.5 w-full border border-nes-black bg-white/40">
            <div
              className="h-full bg-nes-yellow"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}
