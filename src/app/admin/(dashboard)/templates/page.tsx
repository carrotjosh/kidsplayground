import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";

import { TemplateForm } from "./TemplateForm";
import { TemplateRow } from "./TemplateRow";

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
            <TemplateRow
              key={template.id}
              template={{
                id: template.id,
                title: template.title,
                subject: template.subject ?? template.title,
                amount: template.amount,
                unit: template.unit,
                points: template.points,
                emoji: template.emoji,
                scheduleType: template.scheduleType,
                weekdays: template.weekdays,
                active: template.active,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
