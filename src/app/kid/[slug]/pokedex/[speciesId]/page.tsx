import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KidNavBar } from "@/components/KidNavBar";
import { Pinyin } from "@/components/Pinyin";
import { CaughtStatus, Gender, KidTheme } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { flattenByDepth, getEvolutionChain } from "@/lib/evolution";
import { masteryGoal, RARITY_LABELS } from "@/lib/pokedex";
import { pokemonArtPath } from "@/lib/pokemonArt";
import { multiplierLabel, typeColor, typeLabel, typeMatchups } from "@/lib/pokemonTypes";

export const dynamic = "force-dynamic";

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "♂ 男孩子",
  FEMALE: "♀ 女孩子",
  UNKNOWN: "没有性别",
};

/**
 * 单只宝可梦的详情页。
 *
 * 除了"抓到了几只"，这一页真正想给的是**可以琢磨的东西**：完整进化路径、
 * 属性、以及怕什么／不怕什么。属性克制是一套真的推理系统（双属性还要相乘，
 * 草/地面是四倍怕冰），一年级孩子完全学得会，而且学会之后
 * "该用哪个球去抓哪只"就从碰运气变成了有依据的判断。
 */
export default async function SpeciesDetailPage({
  params,
}: {
  params: Promise<{ slug: string; speciesId: string }>;
}) {
  const { slug, speciesId: raw } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();
  if (child.theme !== KidTheme.POKEDEX) notFound();

  const speciesId = Number(raw);
  if (!Number.isInteger(speciesId)) notFound();

  const species = await prisma.pokemonSpecies.findUnique({ where: { id: speciesId } });
  if (!species) notFound();

  const [mine, chain] = await Promise.all([
    prisma.caught.findMany({
      where: { childId: child.id, speciesId, status: CaughtStatus.OWNED },
      orderBy: { caughtAt: "desc" },
    }),
    getEvolutionChain(speciesId),
  ]);

  const { weak, resist } = typeMatchups(species.types);
  const goal = masteryGoal(species.rarity);
  const levels = flattenByDepth(chain.root);

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-5 md:max-w-3xl lg:max-w-4xl lg:gap-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text={species.nameZh} />
        </h1>
        <span className="pixel-card kid-text bg-white px-3 py-1.5 text-base text-slate-600 lg:text-lg">
          No.{species.id} · <Pinyin text={RARITY_LABELS[species.rarity]} />
        </span>
      </header>

      {/* 立绘 + 属性 + 六项数值 */}
      <section className="pixel-card flex flex-wrap items-center gap-5 bg-white p-4 lg:p-6">
        <Image
          src={pokemonArtPath(species.id)}
          alt={species.nameZh}
          width={160}
          height={160}
          unoptimized
          className="animate-float mx-auto h-32 w-32 lg:h-40 lg:w-40"
        />
        <div className="flex min-w-56 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {species.types.map((t) => (
              <span
                key={t}
                className="pixel-border kid-text px-3 py-1 text-base text-white lg:text-lg"
                style={{ backgroundColor: typeColor(t) }}
              >
                <Pinyin text={typeLabel(t)} />
              </span>
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["HP", species.hp],
              ["攻击", species.attack],
              ["防御", species.defense],
              ["特攻", species.spAtk],
              ["特防", species.spDef],
              ["速度", species.speed],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-2 border-slate-200 p-1.5">
                <dt className="kid-text text-xs text-slate-500 lg:text-sm">
                  <Pinyin text={String(label)} />
                </dt>
                <dd className="pixel-font text-base text-slate-800 lg:text-lg">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="kid-text text-sm text-slate-500 lg:text-base">
            <Pinyin
              text={`招牌技能：${species.moveName}（威力 ${species.movePower}）· 特性：${species.abilities.join("、")}`}
            />
          </p>
        </div>
      </section>

      {/* 怕什么。这是这一页最有嚼头的部分，位置排在进化前面 */}
      <section className="pixel-card flex flex-col gap-3 bg-white p-4 lg:p-6">
        <h2 className="kid-text text-lg text-slate-800 lg:text-xl">
          <Pinyin text="它怕什么" /> ⚔️
        </h2>
        {weak.length === 0 ? (
          <p className="kid-text text-slate-500">
            <Pinyin text="什么都不特别怕，很均衡" />
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weak.map((m) => (
              <span
                key={m.type}
                className="pixel-border kid-text flex items-center gap-1.5 px-3 py-1.5 text-base text-white lg:text-lg"
                style={{ backgroundColor: typeColor(m.type) }}
              >
                <Pinyin text={`${m.label}·${multiplierLabel(m.multiplier)}`} />
              </span>
            ))}
          </div>
        )}

        {resist.length > 0 && (
          <>
            <h2 className="kid-text mt-1 text-lg text-slate-800 lg:text-xl">
              <Pinyin text="它不怕什么" /> 🛡️
            </h2>
            <div className="flex flex-wrap gap-2">
              {resist.map((m) => (
                <span
                  key={m.type}
                  className="kid-text flex items-center gap-1.5 border-2 border-slate-200 px-3 py-1.5 text-base text-slate-600 lg:text-lg"
                >
                  <span
                    className="h-3 w-3 shrink-0 border border-nes-black"
                    style={{ backgroundColor: typeColor(m.type) }}
                  />
                  <Pinyin text={`${m.label}·${multiplierLabel(m.multiplier)}`} />
                </span>
              ))}
            </div>
          </>
        )}
        <p className="kid-text text-sm text-slate-400 lg:text-base">
          <Pinyin text="有两个属性的宝可梦，两边的效果要乘起来，所以会有「非常怕」" />
        </p>
      </section>

      {/* 进化路径。按层横排，伊布那种一变多的也画得对 */}
      {levels.length > 1 && (
        <section className="pixel-card flex flex-col gap-3 bg-white p-4 lg:p-6">
          <h2 className="kid-text text-lg text-slate-800 lg:text-xl">
            <Pinyin text="进化路线" /> 🔄
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {levels.map((level, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-2xl text-slate-400">→</span>}
                <div className="flex flex-wrap gap-2">
                  {level.map((node) => (
                    <Link
                      key={node.id}
                      href={`/kid/${slug}/pokedex/${node.id}`}
                      className={`flex w-20 flex-col items-center border-2 p-1 text-center lg:w-24 ${
                        node.id === species.id
                          ? "border-nes-black bg-nes-yellow"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <Image
                        src={pokemonArtPath(node.id)}
                        alt={node.nameZh}
                        width={64}
                        height={64}
                        unoptimized
                      />
                      <span className="kid-text truncate text-xs text-slate-700 lg:text-sm">
                        <Pinyin text={node.nameZh} />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 我抓到的这几只。每只的性别/特性/闪光都是独立随机的，所以要分开列 */}
      <section className="pixel-card flex flex-col gap-3 bg-white p-4 lg:p-6">
        <h2 className="kid-text text-lg text-slate-800 lg:text-xl">
          <Pinyin text={`我抓到的（${mine.length} / ${goal} 只算收集完成）`} /> 🎒
        </h2>
        {mine.length === 0 ? (
          <p className="kid-text text-slate-500">
            <Pinyin text="还没有抓到过这一只" />
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((c) => (
              <li
                key={c.id}
                className="kid-text flex flex-wrap gap-x-3 border-2 border-slate-200 px-3 py-2 text-sm text-slate-600 lg:text-base"
              >
                {c.isShiny && <span className="text-nes-red">✨ 闪光</span>}
                <span>
                  <Pinyin text={GENDER_LABEL[c.gender]} />
                </span>
                <span>
                  <Pinyin text={`特性 ${c.ability}`} />
                </span>
                <span>
                  <Pinyin text={`${c.moveName} ${c.movePower}`} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <KidNavBar
        items={[
          { href: `/kid/${slug}/pokedex`, label: "回图鉴", emoji: "⬅️", tone: "sky" },
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "📋", tone: "green" },
        ]}
      />
    </main>
  );
}
