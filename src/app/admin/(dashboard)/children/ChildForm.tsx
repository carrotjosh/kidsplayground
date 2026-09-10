"use client";

import { useActionState } from "react";

import { createChildAction } from "./actions";

export function ChildForm() {
  const [error, formAction, isPending] = useActionState(createChildAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增孩子</h2>
      <p className="text-sm text-slate-500">
        建好之后会自动配上一套默认的任务模板、礼物和 4 种植物，可以直接开始用，也可以再去各页面改。
      </p>
      <div className="flex flex-wrap gap-3">
        <input
          name="name"
          placeholder="孩子的名字"
          required
          maxLength={20}
          className="w-56 rounded-none border-2 border-nes-black px-3 py-2"
        />
        <button
          type="submit"
          disabled={isPending}
          className="pixel-btn bg-nes-red px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "创建中..." : "新增孩子"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
