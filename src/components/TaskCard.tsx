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
    <div className="pixel-card flex items-center justify-between gap-4 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl">{task.emoji ?? "📌"}</span>
        <div>
          <p className="text-xl font-bold text-slate-800">{task.title}</p>
          <p className="pixel-font text-[10px] text-nes-brown">+{task.points}</p>
        </div>
      </div>

      {isDone ? (
        <span className="pixel-border pixel-text-outline bg-nes-green px-4 py-3 text-lg font-bold text-white">
          完成 ✅
        </span>
      ) : (
        <form action={completeAction}>
          <button
            type="submit"
            className="pixel-btn bg-nes-red px-6 py-3 text-lg font-bold text-white"
          >
            完成！
          </button>
        </form>
      )}
    </div>
  );
}
