"use client";

import { useActionState, useRef, useState } from "react";

import { deleteTemplateAction, toggleTemplateActiveAction, updateTemplateAction } from "./actions";
import { TemplateFields, type TemplateFieldValues } from "./TemplateFields";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function formatSchedule(scheduleType: string, weekdays: number[]): string {
  if (scheduleType === "WORKDAY") return "法定工作日（含调休补班）";
  if (scheduleType === "HOLIDAY") return "法定节假日";
  return [...weekdays]
    .sort((a, b) => a - b)
    .map((d) => `周${WEEKDAY_LABELS[d]}`)
    .join("、");
}

export function TemplateRow({
  template,
}: {
  template: TemplateFieldValues & { id: string; title: string; active: boolean };
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await updateTemplateAction(template.id, prev, formData);
      if (result === null) setEditing(false); // 保存成功才收起编辑区
      return result;
    },
    null
  );
  const deleteFormRef = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-3 pixel-card bg-amber-50 p-5">
        <h3 className="font-semibold">编辑「{template.title}」</h3>
        <p className="text-xs text-slate-500">
          保存后，今天已生成但孩子还没提交的那条任务会一起更新；已提交/已批准的和历史记录不动。
        </p>

        <TemplateFields initial={template} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="pixel-btn bg-nes-green px-4 py-2 text-white disabled:opacity-50"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="pixel-btn bg-white px-4 py-2 text-slate-600"
          >
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 pixel-card bg-white p-4">
      <div className="min-w-0">
        <p className="font-semibold">
          {template.emoji} {template.title}（{template.points} 阳光）
          {!template.active && <span className="ml-2 text-xs text-slate-400">已停用</span>}
        </p>
        <p className="text-sm text-slate-500">
          {formatSchedule(template.scheduleType, template.weekdays)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
        >
          编辑
        </button>

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

        <form ref={deleteFormRef} action={deleteTemplateAction.bind(null, template.id)}>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `确定删除任务模板「${template.title}」吗？\n\n以后不会再自动生成这个任务，但已经打过卡的历史记录会保留。`
                )
              ) {
                deleteFormRef.current?.requestSubmit();
              }
            }}
            className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
          >
            删除
          </button>
        </form>
      </div>
    </div>
  );
}
