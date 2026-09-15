import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { collectionNavItem } from "@/lib/theme";
import { MonthCalendar, MonthNav } from "@/components/MonthCalendar";
import { Pinyin } from "@/components/Pinyin";
import { KID_BADGE_HEIGHT } from "@/components/badgeHeight";
import { LevelBadge } from "@/components/LevelBadge";
import { LevelUpBanner } from "@/components/LevelUpBanner";
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
import { checkLevelUp, levelProgress, totalEarned } from "@/lib/level";
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

  await settleMonthlyBonusForChild(child);

  // 满勤奖算进等级，所以要排在结算之后
  const levelUp = await checkLevelUp(child.id);

  const [tasks, balance, summary, earned] = await Promise.all([
    getOrCreateTodayTasks(child.id),
    getPointsBalance(child.id),
    getMonthSummary(child, month),
    totalEarned(child.id),
  ]);
  const progress = levelProgress(levelUp?.level ?? child.level, earned);
  const today = todayDateString();

  return (
    // 一屏容器在 layout.tsx，这里只管内容。上中下三块：
    // 今天要做的事 → 打卡日历（占剩余全部高度）→ 花园/礼物商店。
    <>
      {/* flex-wrap 是保命的：容器是 overflow-hidden，这一行一旦超宽不会出滚动条，
          而是**直接把右边裁掉**——阳光总数就那么没了，而且在桌面上完全看不出来 */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text kid-body text-white">
          <Pinyin text={`${child.name}，你好`} />
        </h1>
        <div className="flex items-center gap-3">
          {/* 今天几号星期几放在顶部、紧挨着阳光总数，做成同样的卡片让它醒目。
              高度和另外两张卡共用 KID_BADGE_HEIGHT，三张并排上下边缘才齐。

              **手机上藏起来**：它是这一行里最宽的一块（约 214px），
              四样东西加起来 545px 塞不进 375px 的屏。日期在手机自己的状态栏里就有，
              等级和阳光却是孩子每天要看的，所以砍它。 */}
          <div
            className={`pixel-card hidden ${KID_BADGE_HEIGHT} items-center gap-2 bg-white px-4 sm:flex lg:px-5`}
          >
            <span className="text-3xl lg:text-4xl">📅</span>
            <p className="kid-text kid-body leading-tight text-slate-800">
              <Pinyin text={formatDateWithWeekday(today)} />
            </p>
          </div>
          <LevelBadge progress={progress} href={`/kid/${slug}/level`} />
          <PointsBadge balance={balance} />
        </div>
      </header>

      {/* 升级横幅。首页是锁死一屏的布局，中间那块是 flex-1，会自动让出这几十像素 */}
      {levelUp && <LevelUpBanner levelUp={levelUp} />}

      {/* 中间区域：**窄屏单栏、md 起左右分栏**。
          原来是写死的 38%/62% 两栏，手机竖屏 375px 下左栏只有 142px，任务卡完全没法看——
          而家长用手机替孩子打卡正是主要场景之一。
          窄屏下日历整块隐藏，改成标题行里一个「看日历」的跳转（见下面），
          因为手机上真正要做的事就是打卡本身，日历是次要的。
          两栏的标题行都用 h-11/h-12 固定高度，保证卡片顶边和日历顶边对齐。 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row lg:gap-4">
        {/* 左：今天我要做的事。窄屏占满，md 起收成 38% */}
        <section className="flex min-h-0 flex-1 flex-col gap-1 md:w-[38%] md:max-w-md md:flex-none">
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 lg:h-12">
            <h2 className="kid-text pixel-text-outline kid-label text-white">
              <Pinyin text="今天我要做的事" />
            </h2>
            {/* 只在窄屏出现：日历那一栏这时是隐藏的，得给个入口，
                否则手机上就再也点不到日历了 */}
            <Link
              href={`/kid/${slug}/calendar`}
              className="kid-text pixel-text-outline kid-label whitespace-nowrap text-white md:hidden"
            >
              📅 <Pinyin text="看日历" /> →
            </Link>
          </div>
          {tasks.length === 0 ? (
            <p className="pixel-card kid-text bg-white p-3 text-center kid-body text-slate-500">
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

        {/* 右：我的打卡日历。**窄屏隐藏** —— 手机上塞不下两栏，
            而打卡才是手机端的主场景；日历通过左栏标题行那个「看日历」进 */}
        <section className="hidden min-h-0 flex-1 flex-col gap-1 md:flex">
          {/* 翻月控件提到标题行里（而不是留在日历内部），这样右栏也只有一行表头，
              高度和左栏一致，日历顶边才能和第一张任务卡顶边对齐。 */}
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 lg:h-12">
            <div className="flex items-baseline gap-3">
              <h2 className="kid-text pixel-text-outline kid-label text-white">
                <Pinyin text="我的打卡日历" />
              </h2>
              {/* 进满勤奖进度页的入口。翻月在这一行右边就能做，所以这里只留"看奖励进度"。 */}
              <Link
                href={`/kid/${slug}/calendar`}
                className="kid-text pixel-text-outline whitespace-nowrap kid-label text-white"
              >
                <Pinyin text="看奖励进度" /> →
              </Link>
            </div>
            <MonthNav month={summary.month} basePath={`/kid/${slug}`} big />
          </div>
          <div className="min-h-0 flex-1">
            <MonthCalendar
              summary={summary}
              basePath={null}
              dayHref={(d) => `/kid/${slug}/day/${d}`}
              big
              fitHeight
            />
          </div>
        </section>
      </div>

      {/* 三、我的花园 + 礼物商店 */}
      <KidNavBar
        compact
        items={[
          collectionNavItem(child.theme, slug),
          { href: `/kid/${slug}/rewards`, label: "礼物商店", emoji: "🎁", tone: "pink" },
        ]}
      />
    </>
  );
}
