import type { MonthStats, SpendBucket } from "@/lib/analytics";

function Bar({
  buckets,
  total,
  tone,
}: {
  buckets: SpendBucket[];
  total: number;
  tone: "earn" | "spend";
}) {
  if (buckets.length === 0) {
    return <p className="text-sm text-slate-400">这个月没有记录。</p>;
  }

  const colors =
    tone === "earn"
      ? ["bg-nes-green", "bg-emerald-400", "bg-teal-400", "bg-lime-400"]
      : ["bg-nes-red", "bg-nes-pink", "bg-orange-400", "bg-amber-400"];

  return (
    <div className="flex flex-col gap-2">
      {/* 占比条：各来源按金额横向拼成一整条 */}
      <div className="flex h-4 w-full overflow-hidden border-2 border-nes-black bg-slate-100">
        {buckets.map((b, i) => (
          <div
            key={b.label}
            className={colors[i % colors.length]}
            style={{ width: `${total > 0 ? (b.amount / total) * 100 : 0}%` }}
            title={`${b.label}：${b.amount} 阳光`}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {buckets.map((b, i) => (
          <li key={b.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <i className={`inline-block h-3 w-3 border border-nes-black ${colors[i % colors.length]}`} />
              {b.label}
              <span className="text-xs text-slate-400">×{b.count}</span>
            </span>
            <span className="font-semibold">
              {b.amount}
              <span className="ml-1 text-xs text-slate-400">
                {total > 0 ? `${Math.round((b.amount / total) * 100)}%` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailList({ title, rows }: { title: string; rows: SpendBucket[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-500">{title}</p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-2">
            <span>
              {r.label}
              {r.count > 1 && <span className="ml-1 text-xs text-slate-400">×{r.count}</span>}
            </span>
            <span className="text-slate-600">{r.amount} 阳光</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 家长端仪表盘的月度数据分析：打卡达标率 + 阳光收入构成 + 阳光支出构成。 */
export function MonthStatsPanel({ stats }: { stats: MonthStats }) {
  const pct = Math.round(stats.reachedRatio * 100);
  const [year, monthNum] = stats.month.split("-");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold">
        {year} 年 {Number(monthNum)} 月 数据分析
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 打卡达标率 */}
        <div className="pixel-card flex flex-col gap-2 bg-white p-5">
          <p className="text-sm text-slate-500">打卡达标率</p>
          <p className="text-3xl font-bold">
            {pct}
            <span className="text-lg">%</span>
          </p>
          <div className="h-3 w-full border-2 border-nes-black bg-slate-100">
            <div className="h-full bg-nes-green" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {stats.reachedDays} / {stats.taskDays} 天达标 · 任务完成 {stats.doneTasks}/
            {stats.totalTasks} 个
          </p>
        </div>

        {/* 阳光收入。撤销打卡、家长扣分算在这一栏里做减项，而不是算进"花掉"——
            那些阳光根本没花出去，混进支出会让收支两边同时虚高。 */}
        <div className="pixel-card flex flex-col gap-3 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-500">本月获得阳光</p>
            <p className="text-2xl font-bold text-emerald-600">+{stats.earned}</p>
          </div>
          <Bar buckets={stats.earnedBuckets} total={stats.earnedGross} tone="earn" />

          {stats.reversed > 0 && (
            <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
              <p className="flex justify-between text-sm">
                <span className="text-slate-500">扣减</span>
                <span className="font-semibold text-slate-600">-{stats.reversed}</span>
              </p>
              <ul className="flex flex-col gap-0.5 text-xs text-slate-500">
                {stats.reversedBuckets.map((b) => (
                  <li key={b.label} className="flex justify-between gap-2">
                    <span>
                      {b.label}
                      <span className="ml-1 text-slate-400">×{b.count}</span>
                    </span>
                    <span>-{b.amount}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400">
                毛收入 {stats.earnedGross} − 扣减 {stats.reversed} = 净得 {stats.earned}
              </p>
            </div>
          )}
        </div>

        {/* 阳光支出 */}
        <div className="pixel-card flex flex-col gap-3 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-slate-500">本月花掉阳光</p>
            <p className="text-2xl font-bold text-nes-red">-{stats.spent}</p>
          </div>
          <Bar buckets={stats.spentBuckets} total={stats.spent} tone="spend" />
          <p className="text-xs text-slate-400">只统计真正花出去的：兑换礼物、种植物。</p>
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
            <DetailList title="兑换了这些礼物" rows={stats.rewardDetail} />
            <DetailList title="种了这些植物" rows={stats.plantDetail} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 最近几个月的横向对比：达标率、赚的阳光、花的阳光。 */
export function MonthTrend({ months }: { months: MonthStats[] }) {
  const maxEarned = Math.max(1, ...months.map((m) => m.earned));
  const maxSpent = Math.max(1, ...months.map((m) => m.spent));

  return (
    <div className="pixel-card flex flex-col gap-3 bg-white p-5">
      <h2 className="font-semibold">最近 {months.length} 个月趋势</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="pb-2">月份</th>
              <th className="pb-2">达标率</th>
              <th className="pb-2">获得阳光</th>
              <th className="pb-2">花掉阳光</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-slate-100">
                <td className="py-2 whitespace-nowrap">{m.month}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 border border-nes-black bg-slate-100">
                      <div
                        className="h-full bg-nes-green"
                        style={{ width: `${Math.round(m.reachedRatio * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs">
                      {m.taskDays > 0 ? `${Math.round(m.reachedRatio * 100)}%` : "—"}
                    </span>
                  </div>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 border border-nes-black bg-slate-100">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${(m.earned / maxEarned) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{m.earned}</span>
                  </div>
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 border border-nes-black bg-slate-100">
                      <div
                        className="h-full bg-nes-red"
                        style={{ width: `${(m.spent / maxSpent) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs">{m.spent}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
