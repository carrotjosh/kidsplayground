import type { BallTier } from "@/generated/prisma/client";

/**
 * 四种精灵球。原创手绘 SVG，配色沿用原作的辨识度（红/蓝/黄黑/紫），
 * 但不是游戏素材——画法和注意事项同 PlantSprite.tsx。
 *
 * 教训写在前面：描边宽度是按 viewBox 单位算的，画小元素时很容易被自己的描边吞掉
 * （PWA 图标那次踩过）。这里 viewBox 用 64，描边 3 ≈ 4.7%，放大到 512 也不糊。
 */

const OUTLINE = "#101010";

/** 每种球的上半球配色。下半球一律白色，这是精灵球的通用识别特征。 */
const TOP_COLOR: Record<BallTier, string> = {
  POKE: "#e4000f",
  GREAT: "#2f7fe0",
  ULTRA: "#f0a000",
  MASTER: "#8e44c8",
};

export function BallSprite({
  tier,
  className = "",
}: {
  tier: BallTier;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="精灵球">
      {/* 下半球先画（白色整圆），上半球用半圆盖在上面 */}
      <circle cx="32" cy="32" r="27" fill="#f5f5f5" stroke={OUTLINE} strokeWidth="3" />
      <path d="M5 32 A27 27 0 0 1 59 32 Z" fill={TOP_COLOR[tier]} stroke={OUTLINE} strokeWidth="3" />

      {tier === "GREAT" && (
        // 超级球：上半球两道红色弧纹
        <>
          <path
            d="M14 20 Q22 11 32 10"
            stroke="#e4000f"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M50 20 Q42 11 32 10"
            stroke="#e4000f"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}

      {tier === "ULTRA" && (
        // 高级球：上半球一个黑色 H 形标记
        <>
          <path d="M20 12 L20 27" stroke={OUTLINE} strokeWidth="6" strokeLinecap="round" />
          <path d="M44 12 L44 27" stroke={OUTLINE} strokeWidth="6" strokeLinecap="round" />
          <path d="M20 19 L44 19" stroke={OUTLINE} strokeWidth="5" />
        </>
      )}

      {tier === "MASTER" && (
        // 大师球：紫底 + 两个粉色圆 + 中间大写 M
        <>
          <circle cx="18" cy="18" r="5.5" fill="#ff8ca0" stroke={OUTLINE} strokeWidth="2.5" />
          <circle cx="46" cy="18" r="5.5" fill="#ff8ca0" stroke={OUTLINE} strokeWidth="2.5" />
          <path
            d="M25 26 L25 12 L32 20 L39 12 L39 26"
            stroke="#ffffff"
            strokeWidth="3.5"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}

      {/* 中间那条黑带和按钮，四种球都一样 */}
      <path d="M5 32 H59" stroke={OUTLINE} strokeWidth="6" />
      <circle cx="32" cy="32" r="9" fill="#f5f5f5" stroke={OUTLINE} strokeWidth="3" />
      <circle cx="32" cy="32" r="4" fill="#ffffff" stroke={OUTLINE} strokeWidth="2.5" />
    </svg>
  );
}
