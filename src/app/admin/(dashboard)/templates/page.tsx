import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { deleteTemplateAction, toggleTemplateActiveAction } from "./actions";
import { DeleteTemplateButton } from "./DeleteTemplateButton";
import { TemplateForm } from "./TemplateForm";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function formatSchedule(scheduleType: string, weekdays: number[]): string {
  if (scheduleType === "WORKDAY") return "法定工作日（含调休补班）";
  if (scheduleType === "HOLIDAY") return "法定节假日";
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => `周${WEEKDAY_LABELS[d]}`)
    .join("、");
}

export default async function TemplatesPage() {
  const child = await getPrimaryChild();
  const templates = await prisma.taskTemplate.findMany({
    where: { childId: child.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">任务模板</h1>

      <TemplateForm />

      <div className="flex flex-col gap-3">
        {templates.length === 0 ? (
          <p className="text-slate-500">还没有任务模板。</p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between gap-3 pixel-card bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {template.emoji} {template.title}（{template.points} 阳光）
                  {!template.active && (
                    <span className="ml-2 text-xs text-slate-400">已停用</span>
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  {formatSchedule(template.scheduleType, template.weekdays)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={toggleTemplateActiveAction.bind(null, template.id, !template.active)}>
                  <button
                    type="submit"
                    className={
                      template.active
                        ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                        : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
                    }
                  >
                    {template.active ? "停用" : "启用"}
                  </button>
                </form>
                <DeleteTemplateButton
                  deleteAction={deleteTemplateAction.bind(null, template.id)}
                  title={template.title}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
