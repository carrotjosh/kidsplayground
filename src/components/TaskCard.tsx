type Task = {
  id: string;
  title: string;
  emoji: string | null;
  points: number;
  status: string;
};

export function TaskCard({
  task,
  completeAction,
}: {
  task: Task;
  completeAction: (formData: FormData) => Promise<void>;
}) {
  const isDone = task.status === "DONE";

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{task.emoji ?? "📌"}</span>
        <div>
          <p className="text-xl font-semibold text-slate-800">{task.title}</p>
          <p className="text-sm text-amber-600">+{task.points} 分</p>
        </div>
      </div>

      {isDone ? (
        <span className="rounded-full bg-emerald-100 px-5 py-3 text-lg font-bold text-emerald-700">
          已完成 ✅
        </span>
      ) : (
        <form action={completeAction}>
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-6 py-3 text-lg font-bold text-white shadow active:scale-95"
          >
            完成
          </button>
        </form>
      )}
    </div>
  );
}
