type Task = {
  id: string;
  title: string;
  emoji: string | null;
  points: number;
  status: string;
};

function TaskInfo({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-4xl lg:text-5xl">{task.emoji ?? "📌"}</span>
      <div>
        <p className="text-xl font-bold text-slate-800 lg:text-2xl">{task.title}</p>
        <p className="pixel-font text-[10px] text-nes-brown lg:text-xs">+{task.points} ☀️</p>
      </div>
    </div>
  );
}

export function TaskCard({
  task,
  submitAction,
}: {
  task: Task;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  if (task.status === "DONE") {
    return (
      <div className="pixel-card flex items-center justify-between gap-4 bg-white p-4 lg:p-6">
        <TaskInfo task={task} />
        <span className="pixel-border pixel-text-outline bg-nes-green px-4 py-3 text-lg font-bold text-white lg:px-5 lg:py-4 lg:text-xl">
          完成 ✅
        </span>
      </div>
    );
  }

  if (task.status === "PENDING_REVIEW") {
    return (
      <div className="pixel-card flex items-center justify-between gap-4 bg-slate-100 p-4 lg:p-6">
        <TaskInfo task={task} />
        <span className="pixel-border pixel-text-outline bg-slate-400 px-4 py-3 text-lg font-bold text-white lg:px-5 lg:py-4 lg:text-xl">
          待审核 ⏳
        </span>
      </div>
    );
  }

  return (
    <div className="pixel-card flex items-center justify-between gap-4 bg-white p-4 lg:p-6">
      <TaskInfo task={task} />
      <form action={submitAction}>
        <button
          type="submit"
          className="pixel-btn bg-nes-red px-6 py-3 text-lg font-bold text-white lg:px-8 lg:py-4 lg:text-xl"
        >
          完成！
        </button>
      </form>
    </div>
  );
}
