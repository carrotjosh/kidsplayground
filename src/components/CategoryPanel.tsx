import type { CategoryStats } from "@/lib/categoryStats";

/**
 * 「孩子更爱做哪类任务」面板。条形是完成率；右边的小字给出样本量，
 * 免得家长被一个 2/2 = 100% 的分类误导。
 */
export function CategoryPanel({ stats }: { stats: CategoryStats }) {
  return (
    <div className="pixel-card flex flex-col gap-4 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">更爱做哪类任务</h2>
        <span className="text-xs text-slate-400">近 {stats.days} 天 · 按完成率排</span>
      </div>

      {stats.rows.length === 0 ? (
        <p className="text-sm text-slate-500">这段时间还没有任务记录。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stats.rows.map((r) => (
            <li key={r.category ?? "none"} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-semibold">
                  {r.emoji} {r.label}
                  <span className="ml-2 font-normal text-slate-500">
                    完成 {r.done}/{r.scheduled}（{Math.round(r.rate * 100)}%）
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  {r.selfRate === null ? "" : `自己当天交的 ${Math.round(r.selfRate * 100)}% · `}
                  挣了 {r.earned} 阳光
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100">
                <div className={`h-full ${r.color}`} style={{ width: `${Math.round(r.rate * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="border-l-4 border-slate-200 pl-3 text-sm text-slate-600">{stats.verdict}</p>
      <p className="text-xs text-slate-400">
        完成率高不一定是喜欢，也可能只是这类任务更容易，或者您盯得更紧。
        「自己当天交的」比例高，更像是他主动想做。
      </p>
    </div>
  );
}
