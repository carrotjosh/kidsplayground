import { notFound } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { collectionNavItem } from "@/lib/theme";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { TaskStatus } from "@/generated/prisma/client";
import { getDayDetail } from "@/lib/calendar";
import { getChildBySlug } from "@/lib/child";
import { formatDateWithWeekday, isValidDateString, todayDateString } from "@/lib/date";
import { getPointsBalance } from "@/lib/points";

export const dynamic = "force-dynamic";

/** 每种任务状态在孩子端怎么显示。文案短、带图案，不认字也能看懂。 */
const STATUS_STYLE: Record<TaskStatus, { label: string; className: string }> = {
  [TaskStatus.DONE]: { label: "完成 ✅", className: "bg-nes-green text-white" },
  [TaskStatus.PENDING_REVIEW]: { label: "等爸爸妈妈看 ⏳", className: "bg-nes-yellow text-nes-black" },
  [TaskStatus.PENDING]: { label: "没有做 ❌", className: "bg-slate-200 text-slate-500" },
  [TaskStatus.CANCELLED]: { label: "已取消", className: "bg-slate-200 text-slate-500" },
};

export default async function KidDayPage({
  params,
}: {
  params: Promise<{ slug: string; date: string }>;
}) {
  const { slug, date } = await params;
  // 日期是路径参数，等于用户可控输入：非法格式或未来的日期直接 404，不要拿去查库。
  if (!isValidDateString(date) || date > todayDateString()) notFound();

  const child = await getChildBySlug(slug);
  if (!child) notFound();

  const [detail, balance] = await Promise.all([
    getDayDetail(child, date),
    getPointsBalance(child.id),
  ]);

  const month = date.slice(0, 7);
  const isRestDay = detail.dayType === "HOLIDAY" || detail.dayType === "WEEKEND";

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 p-4 md:max-w-3xl lg:max-w-4xl lg:gap-5 lg:p-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-xl text-white lg:text-3xl">
          <Pinyin text={formatDateWithWeekday(date)} />
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {/* 当天小结：拿了多少阳光、算不算达标、是不是休息日 */}
      <section className="pixel-card flex flex-wrap items-center justify-between gap-3 bg-white p-4 lg:p-5">
        <p className="kid-text text-xl text-slate-800 lg:text-2xl">
          <Pinyin text="这天拿到" />{" "}
          <span className="text-2xl text-amber-600 lg:text-4xl">{detail.earned}</span> ☀️
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {detail.holidayName && (
            <span className="pixel-border kid-text bg-rose-100 px-3 py-1 text-base text-rose-500">
              <Pinyin text={detail.holidayName} />
            </span>
          )}
          {detail.isMakeupWorkday && (
            <span className="pixel-border kid-text bg-slate-100 px-3 py-1 text-base text-slate-600">
              <Pinyin text="调休上学" />
            </span>
          )}
          {isRestDay && !detail.holidayName && (
            <span className="pixel-border kid-text bg-rose-50 px-3 py-1 text-base text-rose-400">
              <Pinyin text="休息日" />
            </span>
          )}
          <span
            className={`pixel-border kid-text px-3 py-1 text-base ${
              detail.reachedGoal ? "bg-nes-green text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            <Pinyin
              text={
                detail.reachedGoal
                  ? "达标啦"
                  : `差 ${Math.max(0, detail.dailyGoalPoints - detail.earned)} 阳光达标`
              }
            />
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="pixel-text-outline kid-text text-lg text-white lg:text-xl">
          <Pinyin text="这天要做的事" />
        </h2>

        {detail.tasks.length === 0 ? (
          <p className="pixel-card kid-text bg-white p-5 text-center text-lg text-slate-500">
            <Pinyin text="这天没有安排任务" /> 🌤️
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.tasks.map((task) => {
              const style = STATUS_STYLE[task.status];
              return (
                <div
                  key={task.id}
                  className="pixel-card flex items-center gap-3 bg-white p-3 lg:p-4"
                >
                  <span className="text-3xl lg:text-4xl">{task.emoji ?? "⭐"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="kid-text text-lg text-slate-800 lg:text-xl">
                      <Pinyin text={task.subject ?? task.title} />
                    </p>
                    {task.amount !== null && (
                      <p className="kid-text text-base text-slate-500">
                        <span className="text-xl text-slate-700">{task.amount}</span>{" "}
                        {task.unit && <Pinyin text={task.unit} />}
                      </p>
                    )}
                  </div>
                  <span className="pixel-font shrink-0 text-[10px] text-nes-brown">
                    {task.points} ☀️
                  </span>
                  <span
                    className={`pixel-border kid-text shrink-0 px-3 py-1 text-sm lg:text-base ${style.className}`}
                  >
                    <Pinyin text={style.label} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {detail.plants.length > 0 && (
          <p className="pixel-card kid-text bg-white p-3 text-lg text-slate-700">
            🌱 <Pinyin text="这天种下了" />{" "}
            {detail.plants.map((p) => `${p.emoji ?? ""}${p.title}`).join("、")}
          </p>
        )}

        {!detail.isToday && detail.tasks.some((t) => t.status !== TaskStatus.DONE) && (
          <p className="kid-text text-sm text-white pixel-text-outline">
            <Pinyin text="过去的任务不能再补做啦，要补分请找爸爸妈妈" />
          </p>
        )}
      </section>

      {/* 日历就在首页上，所以"回到日历"带上 ?month= 就能回到孩子刚才在看的那个月。 */}
      <div className="mt-auto">
        <KidNavBar
          items={[
            { href: `/kid/${slug}?month=${month}`, label: "我的打卡日历", emoji: "⬅️", tone: "sky" },
            collectionNavItem(child.theme, slug),
          ]}
        />
      </div>
    </main>
  );
}
