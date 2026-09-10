import { Pinyin } from "@/components/Pinyin";

type Task = {
  id: string;
  title: string;
  subject: string | null;
  amount: number | null;
  unit: string | null;
  emoji: string | null;
  points: number;
  status: string;
};

/**
 * 卡片正文：主题一行，数值+单位一行（数值字号明显更大，单位和主题同号）。
 * 老数据没有拆分过 subject/amount/unit，就退回显示整串 title。
 */
function TaskBody({ task }: { task: Task }) {
  const subject = task.subject ?? task.title;

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-5xl leading-none lg:text-6xl">{task.emoji ?? "📌"}</span>
      <p className="kid-text text-2xl leading-tight text-slate-800 lg:text-3xl">
        <Pinyin text={subject} />
      </p>
      {task.amount !== null && (
        <p className="kid-text flex items-baseline gap-1 leading-tight text-slate-800">
          <span className="text-4xl lg:text-5xl">{task.amount}</span>
          {task.unit && (
            <span className="text-2xl lg:text-3xl">
              <Pinyin text={task.unit} />
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** 阳光奖励：整条居中、黄底高亮。 */
function RewardBanner({ points }: { points: number }) {
  return (
    <div className="pixel-border flex w-full items-center justify-center gap-1 bg-nes-yellow py-2">
      <span className="pixel-font text-base text-nes-black lg:text-lg">+{points}</span>
      <span className="text-xl lg:text-2xl">☀️</span>
    </div>
  );
}

/**
 * 行式任务卡：首页左栏那一列用。每张卡片宽度铺满左栏、高度固定，
 * 所以不管任务名长短、有没有数值单位，所有卡片尺寸都完全一致，不会有大有小。
 * 内部左边放图标和文字（主题一行、数值+单位一行），右边放阳光奖励和按钮。
 */
export function CompactTaskCard({
  task,
  submitAction,
}: {
  task: Task;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  const done = task.status === "DONE";
  const pending = task.status === "PENDING_REVIEW";
  const subject = task.subject ?? task.title;

  return (
    <div
      className={`pixel-card flex h-24 w-full shrink-0 items-center gap-2 p-2 lg:h-28 lg:gap-3 lg:p-3 ${
        pending ? "bg-slate-100" : "bg-white"
      }`}
    >
      <span className="shrink-0 text-3xl leading-none lg:text-4xl">{task.emoji ?? "📌"}</span>

      {/* min-w-0 让长任务名在这里换行/截断，而不是把右边的按钮挤变形 */}
      <div className="flex min-w-0 flex-1 flex-col justify-center leading-tight">
        <p className="kid-text truncate text-base text-slate-800 lg:text-xl">
          <Pinyin text={subject} />
        </p>
        {task.amount !== null && (
          <p className="kid-text flex items-baseline gap-1 text-slate-800">
            <span className="text-2xl lg:text-3xl">{task.amount}</span>
            {task.unit && (
              <span className="text-base lg:text-lg">
                <Pinyin text={task.unit} />
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex w-24 shrink-0 flex-col items-stretch gap-1 lg:w-28">
        <div className="pixel-border flex items-center justify-center gap-1 bg-nes-yellow py-0.5">
          <span className="pixel-font text-[10px] text-nes-black lg:text-xs">+{task.points}</span>
          <span className="text-sm lg:text-base">☀️</span>
        </div>

        {done ? (
          <span className="pixel-border kid-text flex items-center justify-center bg-nes-green py-1 text-sm text-white lg:text-base">
            <Pinyin text="完成" />
          </span>
        ) : pending ? (
          <span className="pixel-border kid-text flex items-center justify-center bg-slate-400 py-1 text-xs text-white lg:text-sm">
            <Pinyin text="等检查" />
          </span>
        ) : (
          <form action={submitAction}>
            <button
              type="submit"
              className="pixel-btn kid-text w-full bg-nes-red py-1 text-sm text-white lg:text-base"
            >
              <Pinyin text="做完了" />
            </button>
          </form>
        )}
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
  const done = task.status === "DONE";
  const pending = task.status === "PENDING_REVIEW";

  return (
    <div
      className={`pixel-card flex h-full flex-col items-center justify-between gap-3 p-4 lg:p-5 ${
        pending ? "bg-slate-100" : "bg-white"
      }`}
    >
      <TaskBody task={task} />
      <RewardBanner points={task.points} />

      {done ? (
        <span className="pixel-border kid-text flex w-full items-center justify-center bg-nes-green py-3 text-xl text-white lg:text-2xl">
          <Pinyin text="完成" /> ✅
        </span>
      ) : pending ? (
        <span className="pixel-border kid-text flex w-full items-center justify-center bg-slate-400 py-3 text-xl text-white lg:text-2xl">
          <Pinyin text="等爸爸妈妈检查" />
        </span>
      ) : (
        <form action={submitAction} className="w-full">
          <button
            type="submit"
            className="pixel-btn kid-text w-full bg-nes-red py-3 text-xl text-white lg:text-2xl"
          >
            <Pinyin text="我做完了" />
          </button>
        </form>
      )}
    </div>
  );
}
