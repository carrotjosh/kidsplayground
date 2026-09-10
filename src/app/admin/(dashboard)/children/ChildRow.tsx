"use client";

import { useActionState, useRef, useState } from "react";

import { deleteChildAction, renameChildAction, switchChildAction } from "./actions";

export function ChildRow({
  child,
  isActive,
  isOnly,
}: {
  child: { id: string; name: string; slug: string };
  isActive: boolean;
  /** 名下只剩这一个孩子时不让删——删完后台每页都会报"还没有创建孩子档案" */
  isOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await renameChildAction(child.id, prev, formData);
      if (result === null) setEditing(false);
      return result;
    },
    null
  );
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const kidPath = `/kid/${child.slug}`;

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-3 pixel-card bg-amber-50 p-5">
        <h3 className="font-semibold">重命名「{child.name}」</h3>
        <input
          name="name"
          defaultValue={child.name}
          required
          maxLength={20}
          className="w-56 rounded-none border-2 border-nes-black px-3 py-2"
        />
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
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pixel-card p-4 ${
        isActive ? "bg-amber-50" : "bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold">
          {child.name}
          {isActive && <span className="ml-2 text-xs text-nes-green">当前管理中</span>}
        </p>
        <p className="truncate text-sm text-slate-500">
          孩子端链接：<code className="text-xs">{kidPath}</code>
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {!isActive && (
          <form action={switchChildAction.bind(null, child.id)}>
            <button type="submit" className="pixel-btn bg-nes-green px-3 py-1 text-sm text-white">
              切换到 TA
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
        >
          改名
        </button>

        <form ref={deleteFormRef} action={deleteChildAction.bind(null, child.id)}>
          <button
            type="button"
            disabled={isOnly}
            title={isOnly ? "至少要留一个孩子" : undefined}
            onClick={() => {
              if (
                window.confirm(
                  `确定删除「${child.name}」吗？\n\n会同时删掉 TA 的全部打卡记录、阳光流水、花园和兑换历史，无法恢复。`
                )
              ) {
                deleteFormRef.current?.requestSubmit();
              }
            }}
            className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            删除
          </button>
        </form>
      </div>
    </div>
  );
}
