import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthCalendar } from "@/components/MonthCalendar";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { CompactTaskCard } from "@/components/TaskCard";
import { getMonthSummary, settleMonthlyBonusForChild } from "@/lib/calendar";
import { getChildBySlug } from "@/lib/child";
import {
  currentMonthString,
  formatDateWithWeekday,
  isValidMonthString,
  todayDateString,
} from "@/lib/date";
import { getPointsBalance } from "@/lib/points";
import { getOrCreateTodayTasks } from "@/lib/tasks";

import { submitTaskAction } from "./actions";

// 今日任务、阳光都是实时数据，不能被 next build 预渲染成静态页面。
export const dynamic = "force-dynamic";

// 手机/平板浏览器"添加到主屏幕"时会用这个标题命名桌面图标，按孩子名字区分。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  return { title: child ? `${child.name}的打卡` : "打卡小星星" };
}

export default async function KidHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ slug }, { month: monthParam }] = await Promise.all([params, searchParams]);
  // 日历可以用左右箭头翻月；任务永远是"今天"的，不跟着日历翻。
  const month = monthParam && isValidMonthString(monthParam) ? monthParam : currentMonthString();

  const child = await getChildBySlug(slug);
  if (!child) notFound();

  await settleMonthlyBonusForChild(child.id);

  const [tasks, balance, summary] = await Promise.all([
    getOrCreateTodayTasks(child.id),
    getPointsBalance(child.id),
    getMonthSummary(child.id, month),
  ]);
  const today = todayDateString();

  return (
    // h-dvh + overflow-hidden：整页锁在一屏内铺满，孩子不用滚动。
    // 上中下三块：今天要做的事 → 打卡日历（占剩余全部高度）→ 花园/礼物商店。
    <main className="pixel-sky-bg flex h-dvh w-full flex-col gap-2 overflow-hidden p-3 lg:gap-3 lg:p-5">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-xl text-white lg:text-3xl">
          <Pinyin text={`${child.name}，你好`} />
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {/* 中间区域左右分栏：左边今天要做的事（一列等大卡片），右边打卡日历（撑满剩余高度） */}
      <div className="flex min-h-0 flex-1 gap-3 lg:gap-4">
        {/* 左：今天我要做的事 */}
        <section className="flex min-h-0 w-[38%] max-w-md shrink-0 flex-col gap-1">
          <div className="shrink-0">
            <h2 className="kid-text pixel-text-outline text-base text-white lg:text-xl">
              <Pinyin text="今天我要做的事" />
            </h2>
            <p className="kid-text pixel-text-outline text-sm text-white lg:text-base">
              <Pinyin text={formatDateWithWeekday(today)} />
            </p>
          </div>
          {tasks.length === 0 ? (
            <p className="pixel-card kid-text bg-white p-3 text-center text-lg text-slate-500">
              <Pinyin text="今天没有任务，休息一下吧" /> 🌤️
            </p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <CompactTaskCard
                  key={task.id}
                  task={task}
                  submitAction={submitTaskAction.bind(null, slug, task.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 右：我的打卡日历 */}
        <section className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex shrink-0 items-baseline justify-between gap-2">
            <h2 className="kid-text pixel-text-outline text-base text-white lg:text-xl">
              <Pinyin text="我的打卡日历" />
            </h2>
            <Link
              href={`/kid/${slug}/calendar`}
              className="kid-text pixel-text-outline text-sm text-white lg:text-base"
            >
              <Pinyin text="看以前的" /> →
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            {/* basePath 传当前页，日历上的左右箭头就能在首页原地翻月 */}
            <MonthCalendar summary={summary} basePath={`/kid/${slug}`} big fitHeight />
          </div>
        </section>
      </div>

      {/* 三、我的花园 + 礼物商店 */}
      <div className="flex shrink-0 gap-2 lg:gap-3">
        {/* animate-delay-half 让两个按钮错开半个周期，一上一下交替跳。 */}
        <Link
          href={`/kid/${slug}/garden`}
          className="pixel-btn animate-bounce-slow animate-delay-half kid-text flex flex-1 items-center justify-center gap-2 bg-nes-green py-2 text-lg text-white lg:py-3 lg:text-2xl"
        >
          🌻 <Pinyin text="我的花园" />
        </Link>
        <Link
          href={`/kid/${slug}/rewards`}
          className="pixel-btn animate-bounce-slow kid-text flex flex-1 items-center justify-center gap-2 bg-nes-pink py-2 text-lg text-white lg:py-3 lg:text-2xl"
        >
          🎁 <Pinyin text="礼物商店" />
        </Link>
      </div>
    </main>
  );
}
