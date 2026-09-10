"use client";

import { useActionState } from "react";

import { createTemplateAction } from "./actions";
import { TemplateFields } from "./TemplateFields";

export function TemplateForm() {
  const [error, formAction, isPending] = useActionState(createTemplateAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增周期性任务</h2>
      <p className="text-sm text-slate-500">
        主题、数值、单位分开填，孩子端会分行显示、数值放大，比一整串文字好认。
        数值和单位可以留空（比如「整理书包」这种没有数量的任务）。
      </p>

      <TemplateFields />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增任务模板"}
      </button>
    </form>
  );
}
