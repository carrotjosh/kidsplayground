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
 * 紧凑版任务卡：首页底部那一条横向任务带用。内容压到一列窄卡片里，
 * 主题一行、数值+单位一行、奖励居中高亮、按钮铺满，和大卡片是同一套信息结构，只是尺寸更小。
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
    // self-start：卡片按自身内容高度排列，不被最高的那张拉伸出一片空白。
    <div
      className={`pixel-card flex w-44 shrink-0 flex-col items-center gap-1 self-start p-2 lg:w-52 lg:gap-2 lg:p-3 ${
        pending ? "bg-slate-100" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none lg:text-3xl">{task.emoji ?? "📌"}</span>
        <p className="kid-text text-base leading-tight text-slate-800 lg:text-lg">
          <Pinyin text={subject} />
        </p>
      </div>

      {task.amount !== null && (
        <p className="kid-text flex items-baseline gap-1 leading-tight text-slate-800">
          <span className="text-2xl lg:text-3xl">{task.amount}</span>
          {task.unit && (
            <span className="text-base lg:text-lg">
              <Pinyin text={task.unit} />
            </span>
          )}
        </p>
      )}

      <div className="pixel-border flex w-full items-center justify-center gap-1 bg-nes-yellow py-0.5">
        <span className="pixel-font text-[10px] text-nes-black lg:text-xs">+{task.points}</span>
        <span className="text-sm lg:text-base">☀️</span>
      </div>

      {done ? (
        <span className="pixel-border kid-text flex w-full items-center justify-center bg-nes-green py-1 text-base text-white lg:text-lg">
          <Pinyin text="完成" /> ✅
        </span>
      ) : pending ? (
        <span className="pixel-border kid-text flex w-full items-center justify-center bg-slate-400 py-1 text-sm text-white lg:text-base">
          <Pinyin text="等检查" />
        </span>
      ) : (
        <form action={submitAction} className="w-full">
          <button
            type="submit"
            className="pixel-btn kid-text w-full bg-nes-red py-1 text-base text-white lg:text-lg"
          >
            <Pinyin text="我做完了" />
          </button>
        </form>
      )}
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
