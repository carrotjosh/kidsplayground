export function PointsBadge({ balance }: { balance: number }) {
  return (
    <div className="pixel-card flex items-center gap-3 bg-nes-yellow px-5 py-3 lg:gap-4 lg:px-7 lg:py-5">
      <span className="animate-coin-spin text-4xl lg:text-5xl">☀️</span>
      <div>
        <p className="pixel-font text-[9px] text-nes-black lg:text-xs">SUNLIGHT</p>
        <p className="pixel-font pixel-text-outline text-2xl text-white lg:text-4xl">{balance}</p>
      </div>
    </div>
  );
}
