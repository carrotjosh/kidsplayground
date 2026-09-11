import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { CaughtStatus, KidTheme } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { checkLevelUp } from "@/lib/level";
import { pokemonArtPath } from "@/lib/pokemonArt";
import { REGIONS, regionAt, speciesCeilingForLevel } from "@/lib/pokedex";

export const dynamic = "force-dynamic";

/** 一页放多少张。8×5 在横屏平板上刚好铺满，又不至于把每张压得看不清。 */
const PAGE_SIZE = 40;

/**
 * 图鉴全览：从 No.1 到全部 386，一张不落地摆出来。
 *
 * 抓到过的是彩色，没抓到的是**灰色剪影**——这是原作图鉴的经典做法，
 * 也是"我还差哪些"最直观的表达；牌库那一页只有抓到的，看不出缺口在哪。
 * 等级还没开放到的那一段额外标一个锁和所需等级，孩子就知道努力的方向。
 *
 * 孩子端不滚动，所以翻页做成底部两个大按钮（平板上是触控，按钮要够大）。
 */
export default async function AllSpeciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const [{ slug }, { p }] = await Promise.all([params, searchParams]);
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  if (child.theme !== KidTheme.POKEDEX) redirect(`/kid/${slug}`);

  const levelUp = await checkLevelUp(child.id);
  const level = levelUp?.level ?? child.level;
  const ceiling = speciesCeilingForLevel(level);
  const total = REGIONS[REGIONS.length - 1].ceiling;

  const pageCount = Math.ceil(total / PAGE_SIZE);
  // 页码来自 URL，是不可信输入：夹到合法范围而不是相信它
  const page = Math.min(Math.max(Number(p) || 1, 1), pageCount);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const [species, mine] = await Promise.all([
    prisma.pokemonSpecies.findMany({
      where: { id: { gte: from, lte: to } },
      select: { id: true, nameZh: true, rarity: true },
      orderBy: { id: "asc" },
    }),
    // 只取种类，不取每一只——这一页关心的是"有没有"，不是"有几只"
    prisma.caught.findMany({
      where: { childId: child.id, status: CaughtStatus.OWNED },
      select: { speciesId: true },
      distinct: ["speciesId"],
    }),
  ]);
  const owned = new Set(mine.map((c) => c.speciesId));
  const ownedOnPage = species.filter((s) => owned.has(s.id)).length;

  return (
    <main className="pixel-sky-bg mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 overflow-hidden p-4 md:max-w-3xl lg:max-w-6xl lg:gap-4 lg:p-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-3xl">
          <Pinyin text="全部宝可梦" /> 📖
        </h1>
        <p className="pixel-card kid-text bg-white px-3 py-1.5 text-base text-slate-700 lg:text-lg">
          <Pinyin
            text={`No.${from}~${to} · ${regionAt(to)}地区 · 这一页收集了 ${ownedOnPage} / ${species.length}`}
          />
        </p>
      </header>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-6 lg:grid-cols-8">
        {species.map((s) => {
          const got = owned.has(s.id);
          const locked = s.id > ceiling;
          return (
            <Link
              key={s.id}
              href={got ? `/kid/${slug}/pokedex/${s.id}` : `/kid/${slug}/pokedex/all?p=${page}`}
              // 没抓到的不给跳详情：详情页讲的是"我抓到的这几只"，空着更让人困惑
              aria-disabled={!got}
              className={`pixel-border flex flex-col items-center p-1 text-center ${
                got ? "bg-white" : "cursor-default bg-slate-200"
              }`}
            >
              <Image
                src={pokemonArtPath(s.id)}
                alt={got ? s.nameZh : ""}
                width={64}
                height={64}
                unoptimized
                // 没抓到的画成灰色剪影：看得见轮廓才有"想把它填上"的冲动
                className={got ? "" : "opacity-45 grayscale"}
              />
              <span className="pixel-font text-[8px] text-slate-400">No.{s.id}</span>
              <span
                className={`kid-text w-full truncate text-xs ${got ? "text-slate-700" : "text-slate-500"}`}
              >
                {got ? s.nameZh : locked ? "🔒" : "？？？"}
              </span>
              {got && (
                <span className="pixel-font text-[8px] text-nes-brown">
                  {"★".repeat(s.rarity)}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 等级还没开到这一页时说清楚原因，不然一整页锁头很挫败 */}
      {from > ceiling && (
        <p className="kid-text shrink-0 text-center text-sm text-white lg:text-base">
          <Pinyin text={`这一页要打卡到更高等级才会出现（现在开放到 No.${ceiling}）`} /> 🔒
        </p>
      )}

      {/* 翻页。孩子端不滚动，所以按钮做大、放在底部拇指够得到的位置 */}
      <div className="flex shrink-0 items-center gap-2">
        <PageLink slug={slug} page={page - 1} disabled={page <= 1} label="← 上一页" />
        <span className="pixel-card kid-text shrink-0 bg-white px-3 py-2 text-base text-slate-700 lg:text-lg">
          {page} / {pageCount}
        </span>
        <PageLink slug={slug} page={page + 1} disabled={page >= pageCount} label="下一页 →" />
      </div>

      <KidNavBar
        compact
        items={[
          { href: `/kid/${slug}/pokedex`, label: "回图鉴", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}/pokedex/deck`, label: "我的牌库", emoji: "🗂️", tone: "green" },
        ]}
      />
    </main>
  );
}

function PageLink({
  slug,
  page,
  disabled,
  label,
}: {
  slug: string;
  page: number;
  disabled: boolean;
  label: string;
}) {
  const cls = "pixel-btn kid-text flex-1 py-3 text-center text-lg lg:text-xl";
  if (disabled) {
    return <span className={`${cls} cursor-default bg-slate-300 text-slate-500`}>{label}</span>;
  }
  return (
    <Link href={`/kid/${slug}/pokedex/all?p=${page}`} className={`${cls} bg-nes-sky text-white`}>
      {label}
    </Link>
  );
}
