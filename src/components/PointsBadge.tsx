/**
 * 阳光总数。和顶栏另外两个卡片（日期、等级）用同一套内边距和 h-full，
 * 三个并排时上下边缘才齐——原来这个卡片单独用了更大的 px-5 py-3，
 * 比旁边两个高出一截。
 */
export function PointsBadge({ balance }: { balance: number }) {
  return (
    <div className="pixel-card flex h-full items-center gap-3 bg-nes-yellow px-4 py-2 lg:gap-4 lg:px-5 lg:py-3">
      <span className="animate-coin-spin text-3xl lg:text-4xl">☀️</span>
      <div>
        <p className="pixel-font text-[9px] text-nes-black lg:text-xs">SUNLIGHT</p>
        <p className="pixel-font pixel-text-outline text-2xl text-white lg:text-3xl">{balance}</p>
      </div>
    </div>
  );
}
