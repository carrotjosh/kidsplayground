"use client";

import { useState } from "react";

import { CATEGORY_META, CATEGORY_ORDER, guessCategory } from "@/lib/taskCategory";

/**
 * 任务分类的单选。任务模板和临时任务两个表单共用。
 *
 * 家长还没手动点过的时候，按「主题」里填的字自动勾一个猜测（读书 → 阅读、跳绳 → 运动），
 * 这样新增任务还是一步完成，不会因为多了个必填项变麻烦；点过之后就以家长选的为准，
 * 不再跟着主题变。没有用 effect 同步：选中项是「手动选的 ?? 猜的」现算出来的。
 */
export function CategoryPicker({
  subject,
  defaultValue,
}: {
  /** 当前主题输入框的值，用来猜分类 */
  subject: string;
  /** 编辑已有任务时传它现在的分类 */
  defaultValue?: string | null;
}) {
  const [picked, setPicked] = useState<string | null>(defaultValue ?? null);
  const selected = picked ?? (subject.trim() ? guessCategory(subject) : null);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">
        分类
        {picked === null && selected && (
          <span className="ml-1 text-slate-400">（按主题猜的，不对就点一下改）</span>
        )}
      </span>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_ORDER.map((c) => {
          const meta = CATEGORY_META[c];
          const on = selected === c;
          return (
            <label
              key={c}
              className={`cursor-pointer border-2 px-2 py-1 text-sm ${
                on ? "border-nes-black bg-amber-100 font-semibold" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={c}
                checked={on}
                onChange={() => setPicked(c)}
                required
                className="sr-only"
              />
              {meta.emoji} {meta.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
