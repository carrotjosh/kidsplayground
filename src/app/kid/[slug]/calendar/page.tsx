import Link from "next/link";
import { notFound } from "next/navigation";

import { MonthCalendar, MonthProgress } from "@/components/MonthCalendar";
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
    <main className="pixel-sky-bg mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-8 lg:p-10 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline text-2xl font-bold text-white lg:text-4xl 2xl:text-5xl">
          我的日历 📅
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <MonthProgress summary={summary} />
      <MonthCalendar summary={summary} basePath={`/kid/${slug}/calendar`} />

      <div className="flex gap-3">
        <Link
          href={`/kid/${slug}`}
          className="pixel-btn flex flex-1 items-center justify-center gap-2 bg-nes-sky px-6 py-4 text-xl font-bold text-white"
        >
          ⬅️ 今日任务
        </Link>
        <Link
          href={`/kid/${slug}/garden`}
          className="pixel-btn flex flex-1 items-center justify-center gap-2 bg-nes-green px-6 py-4 text-xl font-bold text-white"
        >
          🌻 我的花园
        </Link>
      </div>
    </main>
  );
}
