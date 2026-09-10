import type { DisciplineStats } from "@/lib/discipline";

/**
 * 自觉性面板。
 *
 * 这套系统的目标是有一天不再被需要，所以家长需要一个地方看出"他现在还需要吗"。
 * 三个数字讲三件不同的事：达标率讲结果，自觉提交率讲有没有人在后面推，连续天数讲稳定性。
 * 只呈现和解读，不自动调整任何参数——那是教育决策。
 */
export function DisciplinePanel({ stats }: { stats: DisciplineStats }) {
  const rate = stats.activeDays > 0 ? stats.reachedDays / stats.activeDays : null;
  const months = stats.trend.filter((t) => t.rate !== null);

  return (
    <div className="pixel-card flex flex-col gap-4 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">自觉性</h2>
        <span className="text-xs text-slate-400">近 90 天</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric
          label="达标率"
          value={rate === null ? "—" : `${Math.round(rate * 100)}%`}
          sub={`${stats.reachedDays}/${stats.activeDays} 天`}
        />
        <Metric
          label="自己当天提交"
          value={stats.selfReportRate === null ? "—" : `${Math.round(stats.selfReportRate * 100)}%`}
          sub={stats.selfReportRate === null ? "还没有数据" : `共 ${stats.completedTasks} 项任务`}
        />
        <Metric
          label="连续达标"
          value={`${stats.currentStreak} 天`}
          sub={`最长 ${stats.longestStreak} 天`}
        />
      </div>

      {/* 月度趋势。用条形而不是折线：六个点画折线没有信息量，条形一眼能比高低 */}
      {months.length > 1 && (
        <div className="flex items-end gap-2">
          {stats.trend.map((t) => (
            <div key={t.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end border-b-2 border-slate-200">
                <div
                  className={`w-full ${
                    t.rate === null
                      ? "bg-slate-100"
                      : t.rate >= 0.8
                        ? "bg-nes-green"
                        : "bg-amber-400"
                  }`}
                  style={{ height: `${Math.max(4, (t.rate ?? 0) * 100)}%` }}
                  title={t.rate === null ? "无数据" : `${Math.round(t.rate * 100)}%`}
                />
              </div>
              <span className="text-[10px] text-slate-400">{t.month.slice(5)}月</span>
            </div>
          ))}
        </div>
      )}

      <p className="border-l-4 border-slate-200 pl-3 text-sm text-slate-600">{stats.verdict}</p>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}
