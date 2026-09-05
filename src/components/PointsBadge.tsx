export function PointsBadge({ balance }: { balance: number }) {
  return (
    <div className="pixel-card flex items-center gap-3 bg-nes-yellow px-5 py-3">
      <span className="animate-coin-spin text-4xl">🏆</span>
      <div>
        <p className="pixel-font text-[9px] text-nes-black">POINTS</p>
        <p className="pixel-font pixel-text-outline text-2xl text-white">{balance}</p>
      </div>
    </div>
  );
}
