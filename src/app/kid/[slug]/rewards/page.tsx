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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-pink-50 p-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">礼物橱窗 🎁</h1>
        <PointsBadge balance={balance} />
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rewards.length === 0 ? (
          <p className="col-span-full rounded-2xl bg-white p-6 text-center text-lg text-slate-500">
            还没有礼物，等家长上架吧～
          </p>
        ) : (
          rewards.map((reward) => {
            const enough = balance >= reward.cost;
            return (
              <div
                key={reward.id}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white p-5 text-center shadow-sm"
              >
                <span className="text-5xl">{reward.emoji ?? "🎁"}</span>
                <p className="text-lg font-semibold text-slate-800">{reward.title}</p>
                <p className="text-amber-600">{reward.cost} 分</p>
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
        className="flex items-center justify-center gap-2 rounded-2xl bg-sky-400 px-6 py-4 text-xl font-bold text-white shadow"
      >
        ⬅️ 回到今日任务
      </Link>
    </main>
  );
}
