import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PointsBadge } from "@/components/PointsBadge";
import { TaskCard } from "@/components/TaskCard";
import { getChildBySlug } from "@/lib/child";
import { getPointsBalance } from "@/lib/points";
import { getOrCreateTodayTasks } from "@/lib/tasks";

import { submitTaskAction } from "./actions";

// 今日任务、积分都是实时数据，不能被 next build 预渲染成静态页面。
export const dynamic = "force-dynamic";

// 手机浏览器"添加到主屏幕"时会用这个标题命名桌面图标，按孩子名字区分。
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();

  const [tasks, balance] = await Promise.all([
    getOrCreateTodayTasks(child.id),
    getPointsBalance(child.id),
  ]);

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-8 lg:p-10 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline text-2xl font-bold text-white lg:text-4xl 2xl:text-5xl">
          {child.name} 的今日任务
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        {tasks.length === 0 ? (
          <p className="pixel-card col-span-full bg-white p-6 text-center text-lg text-slate-500 lg:p-10 lg:text-2xl">
            今天还没有任务，休息一下吧 🌤️
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              submitAction={submitTaskAction.bind(null, slug, task.id)}
            />
          ))
        )}
      </section>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex gap-3">
          {/* animate-delay-half 让花园按钮比礼物按钮晚半个周期，两个按钮一上一下交替跳，
              比同步跳更有节奏感。 */}
          <Link
            href={`/kid/${slug}/garden`}
            className="pixel-btn animate-bounce-slow animate-delay-half flex flex-1 items-center justify-center gap-2 bg-nes-green px-6 py-4 text-xl font-bold text-white lg:py-6 lg:text-2xl"
          >
            🌻 我的花园
          </Link>
          <Link
            href={`/kid/${slug}/rewards`}
            className="pixel-btn animate-bounce-slow flex flex-1 items-center justify-center gap-2 bg-nes-pink px-6 py-4 text-xl font-bold text-white lg:py-6 lg:text-2xl"
          >
            🎁 礼物橱窗
          </Link>
        </div>
        <Link
          href={`/kid/${slug}/calendar`}
          className="pixel-btn flex items-center justify-center gap-2 bg-nes-yellow px-6 py-4 text-xl font-bold text-nes-black lg:py-5 lg:text-2xl"
        >
          📅 我的日历
        </Link>
      </div>
    </main>
  );
}
