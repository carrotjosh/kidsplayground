import Link from "next/link";
import { notFound } from "next/navigation";

import { PointsBadge } from "@/components/PointsBadge";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";

import { redeemRewardAction } from "../actions";
import { RedeemButton } from "./RedeemButton";

export const dynamic = "force-dynamic";

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();

  const [rewards, balance] = await Promise.all([
    prisma.reward.findMany({
      where: { childId: child.id, active: true },
      orderBy: { cost: "asc" },
    }),
    getPointsBalance(child.id),
  ]);

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-8 lg:p-10 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline text-2xl font-bold text-white lg:text-4xl 2xl:text-5xl">
          礼物橱窗 🎁
        </h1>
        <PointsBadge balance={balance} />
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5 xl:grid-cols-4">
        {rewards.length === 0 ? (
          <p className="pixel-card col-span-full bg-white p-6 text-center text-lg text-slate-500 lg:p-10 lg:text-2xl">
            还没有礼物，等家长上架吧～
          </p>
        ) : (
          rewards.map((reward) => {
            const enough = balance >= reward.cost;
            return (
              <div
                key={reward.id}
                className="pixel-card flex flex-col items-center gap-2 bg-white p-5 text-center lg:p-7"
              >
                <span className="text-5xl lg:text-6xl">{reward.emoji ?? "🎁"}</span>
                <p className="text-lg font-bold text-slate-800 lg:text-xl">{reward.title}</p>
                <p className="pixel-font text-[10px] text-nes-brown lg:text-xs">{reward.cost} ☀️</p>
                <RedeemButton
                  redeemAction={redeemRewardAction.bind(null, slug, reward.id)}
                  disabled={!enough}
                  label={enough ? "我要兑换 🎉" : `还差 ${reward.cost - balance} 阳光`}
                />
              </div>
            );
          })
        )}
      </section>

      <Link
        href={`/kid/${slug}`}
        className="pixel-btn flex items-center justify-center gap-2 bg-nes-sky px-6 py-4 text-xl font-bold text-white lg:py-6 lg:text-2xl"
      >
        ⬅️ 回到今日任务
      </Link>
    </main>
  );
}
