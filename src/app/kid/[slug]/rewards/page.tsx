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
    <main className="pixel-sky-bg mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline text-2xl font-bold text-white">礼物橱窗 🎁</h1>
        <PointsBadge balance={balance} />
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rewards.length === 0 ? (
          <p className="pixel-card col-span-full bg-white p-6 text-center text-lg text-slate-500">
            还没有礼物，等家长上架吧～
          </p>
        ) : (
          rewards.map((reward) => {
            const enough = balance >= reward.cost;
            return (
              <div
                key={reward.id}
                className="pixel-card flex flex-col items-center gap-2 bg-white p-5 text-center"
              >
                <span className="text-5xl">{reward.emoji ?? "🎁"}</span>
                <p className="text-lg font-bold text-slate-800">{reward.title}</p>
                <p className="pixel-font text-[10px] text-nes-brown">{reward.cost} 分</p>
                <RedeemButton
                  redeemAction={redeemRewardAction.bind(null, slug, reward.id)}
                  disabled={!enough}
                  label={enough ? "我要兑换 🎉" : `还差 ${reward.cost - balance} 分`}
                />
              </div>
            );
          })
        )}
      </section>

      <Link
        href={`/kid/${slug}`}
        className="pixel-btn flex items-center justify-center gap-2 bg-nes-sky px-6 py-4 text-xl font-bold text-white"
      >
        ⬅️ 回到今日任务
      </Link>
    </main>
  );
}
