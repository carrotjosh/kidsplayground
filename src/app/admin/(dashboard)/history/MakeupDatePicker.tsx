"use client";

import { useRouter } from "next/navigation";

/**
 * 选一个日期跳到"那天的补打卡"视图。用 router.push 带上 ?day= 查询参数，
 * 页面读到这个参数后会把那天的任务列出来（缺的模板任务会先补生成）。
 */
export function MakeupDatePicker({ value, max }: { value: string; max: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">选择日期</span>
        <input
          type="date"
          defaultValue={value}
          max={max}
          onChange={(e) => {
            if (e.target.value) router.push(`/admin/history?day=${e.target.value}`);
          }}
          className="rounded-none border-2 border-nes-black px-3 py-2"
        />
      </label>
      <button
        type="button"
        onClick={() => router.push("/admin/history")}
        className="pixel-btn bg-white px-3 py-2 text-sm text-slate-600"
      >
        清除
      </button>
    </div>
  );
}
