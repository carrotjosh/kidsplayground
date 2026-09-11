import { KID_BADGE_HEIGHT } from "@/components/badgeHeight";

/**
 * 阳光总数。
 *
 * 高度用 KID_BADGE_HEIGHT 写死，和顶栏另外两张卡（日期、等级）完全一致。
 * 先试过容器 items-stretch 让它们互相撑齐，但三张卡的内容行数不一样
 * （等级卡多一条进度条、日期卡的拼音注音会顶高行框），实际看上去仍然参差。
 * 显式等高 + 内容垂直居中最省心，也不会因为以后往某张卡里多加一行就又歪掉。
 */
export function PointsBadge({ balance }: { balance: number }) {
  return (
    <div
      className={`pixel-card flex ${KID_BADGE_HEIGHT} items-center gap-3 bg-nes-yellow px-4 lg:gap-4 lg:px-5`}
    >
      <span className="animate-coin-spin text-3xl lg:text-4xl">☀️</span>
      <div>
        <p className="pixel-font text-[9px] text-nes-black lg:text-xs">SUNLIGHT</p>
        <p className="pixel-font pixel-text-outline text-2xl text-white lg:text-3xl">{balance}</p>
      </div>
    </div>
  );
}
