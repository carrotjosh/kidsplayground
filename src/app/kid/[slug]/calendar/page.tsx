import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthCalendar, MonthProgress } from "@/components/MonthCalendar";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { getMonthSummary, settleMonthlyBonusForChild } from "@/lib/calendar";
import { getChildBySlug } from "@/lib/child";
import { currentMonthString, isValidMonthString } from "@/lib/date";
import { getPointsBalance } from "@/lib/points";

export const dynamic = "force-dynamic";

export default async function KidCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ slug }, { month: monthParam }] = await Promise.all([params, searchParams]);
  const month = monthParam && isValidMonthString(monthParam) ? monthParam : currentMonthString();

  const child = await getChildBySlug(slug);
  if (!child) notFound();

  // 顺手结算月度满勤奖（幂等），孩子打开日历就能看到奖励到账。
  await settleMonthlyBonusForChild(child.id);

  const [summary, balance] = await Promise.all([
    getMonthSummary(child.id, month),
    getPointsBalance(child.id),
  ]);

  return (
    // 日历撑满整个页面、固定一屏，日历本身占据中间的全部剩余高度，格子尽量大。
    <main className="pixel-sky-bg flex h-dvh w-full flex-col gap-3 overflow-hidden p-4 lg:gap-4 lg:p-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="我的日历" /> 📅
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <div className="shrink-0">
        <MonthProgress summary={summary} />
      </div>

      <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto lg:max-w-2xl">
        <MonthCalendar summary={summary} basePath={`/kid/${slug}/calendar`} big />
      </div>

      <div className="flex shrink-0 gap-3">
        <Link
          href={`/kid/${slug}`}
          className="pixel-btn kid-text flex flex-1 items-center justify-center gap-2 bg-nes-sky py-3 text-xl text-white lg:text-2xl"
        >
          ⬅️ <Pinyin text="今日任务" />
        </Link>
        <Link
          href={`/kid/${slug}/garden`}
          className="pixel-btn kid-text flex flex-1 items-center justify-center gap-2 bg-nes-green py-3 text-xl text-white lg:text-2xl"
        >
          🌻 <Pinyin text="我的花园" />
        </Link>
      </div>
    </main>
  );
}
