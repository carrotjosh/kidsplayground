import { getActiveChild } from "@/lib/child";
import { auditEconomy, recalibrationPreview } from "@/lib/economyAudit";
import { KidTheme } from "@/generated/prisma/client";
import { RARITY_LABELS } from "@/lib/rarity";

import { acceptCurrentPricesAction, recalibrateAction } from "./actions";
import { RecalibrateForm } from "./RecalibrateForm";

export const dynamic = "force-dynamic";

const STATUS_STYLE = {
  ok: "text-slate-500",
  low: "text-amber-600",
  high: "text-nes-red",
} as const;

const STATUS_LABEL = { ok: "", low: "偏便宜", high: "偏贵" } as const;

export default async function EconomyAdminPage() {
  const child = await getActiveChild();
  const [audit, preview] = await Promise.all([
    auditEconomy(child.id),
    recalibrationPreview(child.id),
  ]);

  const errors = audit.findings.filter((f) => f.level === "error");
  const warns = audit.findings.filter((f) => f.level === "warn");
  const hasDrift = preview.rows.length > 0 && Math.abs(preview.factor - 1) >= 0.01;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">经济体检</h1>

      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        所有价格本来是照着「每天 25 阳光」定的。你一改任务模板日薪就变了，而礼物、精灵球、植物的
        价格不会自己跟上——这一页就是把它们换算成「几天工资」摊开来看。
        <br />
        <b>系统自动发的那些数额（满勤奖、刷新费、里程碑、重复返还）不用管</b>，
        它们已经改成按日薪算了，改任务会自动跟上。
      </p>

      {/* ---- 日薪 ---- */}
      <div className="pixel-card flex flex-wrap items-center justify-between gap-4 bg-white p-5">
        <div>
          <p className="text-sm text-slate-500">当前日薪（未来 28 天平均）</p>
          <p className="text-3xl font-bold">
            {audit.rate} <span className="text-base font-normal text-slate-500">阳光 / 天</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            现有价格是按日薪 {audit.baseline} 定的
            {hasDrift && (
              <>
                {" · "}
                <b className={audit.drift > 1 ? "text-nes-red" : "text-amber-600"}>
                  已漂移 {audit.drift > 1 ? "+" : ""}
                  {Math.round((audit.drift - 1) * 100)}%
                </b>
              </>
            )}
          </p>
        </div>
        {hasDrift && (
          <form action={acceptCurrentPricesAction}>
            <button type="submit" className="text-xs text-slate-500 underline">
              价格就这样，别再提示了
            </button>
          </form>
        )}
      </div>

      {/* ---- 问题 ---- */}
      {(errors.length > 0 || warns.length > 0) && (
        <div className="flex flex-col gap-2">
          {[...errors, ...warns].map((f, i) => (
            <div
              key={i}
              className={`pixel-card p-4 text-sm ${
                f.level === "error" ? "bg-red-50 text-nes-red" : "bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-bold">
                {f.level === "error" ? "❌ " : "⚠️ "}
                {f.title}
              </p>
              <p className="mt-1 text-slate-600">{f.detail}</p>
            </div>
          ))}
        </div>
      )}
      {errors.length === 0 && warns.length === 0 && (
        <p className="pixel-card bg-green-50 p-4 text-sm text-green-800">✅ 没有发现问题。</p>
      )}

      {/* ---- 校准 ---- */}
      {hasDrift && (
        <div className="pixel-card flex flex-col gap-3 bg-white p-5">
          <h2 className="font-semibold">调整价格</h2>
          <p className="text-sm text-slate-500">
            不一定要一次调到位——大礼物一次涨三成，对孩子是个不小的打击，分两三次慢慢来更容易接受。
            只调一部分的话，基准值会记成「调到哪儿了」，这一页会继续如实显示还剩多少没调。
          </p>
          <RecalibrateForm
            action={recalibrateAction}
            rows={preview.rows.map((r) => ({ kind: r.kind, label: r.label, from: r.from }))}
            fullPercent={Math.round((preview.factor - 1) * 100)}
          />
        </div>
      )}

      {/* ---- 逐项折算 ---- */}
      {audit.groups.map((group) => (
        <div key={group.title} className="pixel-card flex flex-col gap-2 bg-white p-5">
          <h2 className="font-semibold">{group.title}</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="py-1 font-normal">项目</th>
                <th className="py-1 text-right font-normal">价格</th>
                <th className="py-1 text-right font-normal">折合</th>
                <th className="py-1 text-right font-normal">设计区间</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <tr key={item.label} className="border-t border-slate-100">
                  <td className="py-1.5">{item.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{item.cost}</td>
                  <td className={`py-1.5 text-right tabular-nums ${STATUS_STYLE[item.status]}`}>
                    {item.days.toFixed(1)} 天 {STATUS_LABEL[item.status]}
                  </td>
                  <td className="py-1.5 text-right text-xs text-slate-400 tabular-nums">
                    {item.band ? `${item.band.min}–${item.band.max} 天` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* ---- 自动跟随的数额 ---- */}
      <div className="pixel-card flex flex-col gap-2 bg-slate-50 p-5">
        <h2 className="font-semibold">系统自动发的（跟着日薪走，无需维护）</h2>
        <ul className="text-sm text-slate-600">
          <li>月度满勤奖：{audit.derived.monthlyBonus} 阳光（6 天工资）</li>
          {child.theme === KidTheme.POKEDEX && (
            <>
              <li>刷新今日遇怪：{audit.derived.refresh.join(" / ")} 阳光（递增，每天最多 3 次）</li>
              <li>每集齐 8 种：{audit.derived.milestone} 阳光</li>
              <li>
                单种收集完成：
                {[1, 2, 3, 4]
                  .map((r) => `${RARITY_LABELS[r]} ${audit.derived.mastery[r]}`)
                  .join(" / ")}{" "}
                阳光
              </li>
              <li>
                抓到重复的返还：
                {[1, 2, 3, 4]
                  .map((r) => `${RARITY_LABELS[r]} ${audit.derived.duplicate[r]}`)
                  .join(" / ")}{" "}
                阳光
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
