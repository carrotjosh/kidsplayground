"use client";

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center">
      <p className="text-lg font-semibold text-slate-700">出错了：{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-slate-800 px-4 py-2 text-white"
      >
        重试
      </button>
    </div>
  );
}
