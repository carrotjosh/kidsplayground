import { notFound } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { collectionNavItem } from "@/lib/theme";
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
  await settleMonthlyBonusForChild(child);

  const [summary, balance] = await Promise.all([
    getMonthSummary(child, month),
    getPointsBalance(child.id),
  ]);

  return (
    // 日历撑满整个页面、固定一屏，日历本身占据中间的全部剩余高度，格子尽量大。
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text kid-title text-white">
          <Pinyin text="我的打卡日历" /> 📅
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <div className="shrink-0">
        <MonthProgress summary={summary} big />
      </div>

      <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto lg:max-w-2xl">
        <MonthCalendar
          summary={summary}
          basePath={`/kid/${slug}/calendar`}
          dayHref={(d) => `/kid/${slug}/day/${d}`}
          big
        />
      </div>

      <KidNavBar
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          collectionNavItem(child.theme, slug),
        ]}
      />
    </>
  );
}
