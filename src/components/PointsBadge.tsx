export function PointsBadge({ balance }: { balance: number }) {
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-amber-100 px-6 py-4 shadow-sm">
      <span className="text-4xl">🏆</span>
      <div>
        <p className="text-sm font-medium text-amber-700">我的积分</p>
        <p className="text-3xl font-bold text-amber-900">{balance}</p>
      </div>
    </div>
  );
}
