"use client";

export default function KidError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sky-50 p-6 text-center">
      <p className="text-5xl">😵</p>
      <p className="text-xl font-semibold text-slate-700">出了点小问题，再试一次吧</p>
      <button
        onClick={reset}
        className="rounded-full bg-sky-500 px-6 py-3 text-lg font-bold text-white shadow"
      >
        重试
      </button>
    </main>
  );
}
