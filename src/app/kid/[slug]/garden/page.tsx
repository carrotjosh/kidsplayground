import Link from "next/link";
import { notFound } from "next/navigation";

import { PointsBadge } from "@/components/PointsBadge";
import { PlantStatus } from "@/generated/prisma/client";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { GARDEN_SIZE, settleGardenForChild } from "@/lib/garden";
import { getPointsBalance } from "@/lib/points";

import { plantSeedAction } from "./actions";
import { PlantButton } from "./PlantButton";

export const dynamic = "force-dynamic";

export default async function GardenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();

  // 懒结算：把欠下的僵尸判定补齐，返回这次新发生的事件用于一次性提示。
  const events = await settleGardenForChild(child.id);

  const [alivePlants, plantTypes, balance] = await Promise.all([
    prisma.plant.findMany({ where: { childId: child.id, status: PlantStatus.ALIVE } }),
    prisma.plantType.findMany({ where: { childId: child.id, active: true }, orderBy: { cost: "asc" } }),
    getPointsBalance(child.id),
  ]);

  const slotMap = new Map(alivePlants.map((p) => [p.slot, p]));
  const slots = Array.from({ length: GARDEN_SIZE }, (_, i) => slotMap.get(i) ?? null);
  const isFull = alivePlants.length >= GARDEN_SIZE;

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-8 lg:p-10 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline text-2xl font-bold text-white lg:text-4xl 2xl:text-5xl">
          我的花园 🌻
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {events.length > 0 && (
        <section className="flex flex-col gap-2">
          {events.map((event, i) => (
            <p key={i} className="pixel-card bg-nes-red p-4 text-center text-white lg:p-5">
              {event.outcome === "PLANT_EATEN"
                ? `🧟 ${event.date}：任务没有全部完成，僵尸吃掉了你的 ${event.plantEmoji ?? ""} ${event.plantTitle}！`
                : `🧟 ${event.date}：任务没有全部完成，僵尸来过，还好花园是空的，扑了个空～`}
            </p>
          ))}
        </section>
      )}

      <section className="pixel-card grid grid-cols-3 gap-3 bg-white p-5 sm:grid-cols-4 lg:p-8">
        {slots.map((plant, i) => (
          <div
            key={i}
            className="pixel-border flex aspect-square items-center justify-center bg-amber-100 text-3xl lg:text-4xl"
          >
            {plant ? plant.emoji ?? "🌱" : "🟫"}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="pixel-text-outline text-lg font-bold text-white lg:text-xl">种点什么？</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plantTypes.length === 0 ? (
            <p className="pixel-card col-span-full bg-white p-6 text-center text-slate-500">
              还没有可以种的植物，等家长上架吧～
            </p>
          ) : (
            plantTypes.map((pt) => {
              const enough = balance >= pt.cost;
              return (
                <div
                  key={pt.id}
                  className="pixel-card flex flex-col items-center gap-2 bg-white p-5 text-center"
                >
                  <span className="text-5xl">{pt.emoji ?? "🌱"}</span>
                  <p className="text-lg font-bold text-slate-800">{pt.title}</p>
                  <p className="pixel-font text-[10px] text-nes-brown">{pt.cost} ☀️</p>
                  <PlantButton
                    plantAction={plantSeedAction.bind(null, slug, pt.id)}
                    disabled={!enough || isFull}
                    label={isFull ? "花园满了" : enough ? "种下 🌱" : `还差 ${pt.cost - balance} 阳光`}
                  />
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="flex gap-3">
        <Link
          href={`/kid/${slug}`}
          className="pixel-btn flex flex-1 items-center justify-center gap-2 bg-nes-sky px-6 py-4 text-xl font-bold text-white"
        >
          ⬅️ 今日任务
        </Link>
        <Link
          href={`/kid/${slug}/rewards`}
          className="pixel-btn flex flex-1 items-center justify-center gap-2 bg-nes-pink px-6 py-4 text-xl font-bold text-white"
        >
          🎁 礼物橱窗
        </Link>
      </div>
    </main>
  );
}
