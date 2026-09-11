import { notFound } from "next/navigation";

import { ConfirmActionButton } from "@/components/ConfirmActionButton";
import { KidNavBar } from "@/components/KidNavBar";
import { collectionNavItem } from "@/lib/theme";
import { Pinyin } from "@/components/Pinyin";
import { PointsBadge } from "@/components/PointsBadge";
import { ShopCard } from "@/components/ShopCard";
import { getChildBySlug } from "@/lib/child";
import { prisma } from "@/lib/db";
import { getPointsBalance } from "@/lib/points";
import { formatCooldown, getCooldownStates } from "@/lib/rewards";

import { redeemRewardAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const child = await getChildBySlug(slug);
  if (!child) notFound();

  // 礼物不做等级解锁：这是家长和孩子谈好的约定，藏起来像是反悔。
  // 控制节奏靠价格和冷却，不靠可见性。
  const [rewards, balance] = await Promise.all([
    prisma.reward.findMany({
      where: { childId: child.id, active: true },
      orderBy: { cost: "asc" },
    }),
    getPointsBalance(child.id),
  ]);
  // 冷却状态一次批量查完，不要每个礼物查一次
  const cooldowns = await getCooldownStates(child.id, rewards);

  return (
    <main className="pixel-sky-bg mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 p-5 md:max-w-3xl lg:max-w-5xl lg:gap-8 lg:p-10 2xl:max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="礼物商店" /> 🎁
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {/* 和花园页的植物卡片用同一套断点，两页的卡片节奏一致 */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rewards.length === 0 ? (
          <p className="pixel-card kid-text col-span-full bg-white p-6 text-center text-lg text-slate-500 lg:p-10 lg:text-2xl">
            <Pinyin text="还没有礼物，等家长上架吧" /> 🎁
          </p>
        ) : (
          rewards.map((reward) => {
            const enough = balance >= reward.cost;
            const cooling = cooldowns.get(reward.id);
            const onCooldown = cooling ? !cooling.available : false;

            // 冷却优先于阳光不够：换不了的首要原因先告诉孩子
            const label = onCooldown
              ? `还要等 ${cooling!.daysLeft} 天`
              : enough
                ? "我要兑换 🎉"
                : `还差 ${reward.cost - balance} 阳光`;

            return (
              <ShopCard
                key={reward.id}
                emoji={reward.emoji ?? "🎁"}
                title={reward.title}
                cost={reward.cost}
                note={reward.cooldownDays ? formatCooldown(reward.cooldownDays) : null}
              >
                <ConfirmActionButton
                  action={redeemRewardAction.bind(null, slug, reward.id)}
                  confirmText={`确定用 ${reward.cost} 阳光兑换${reward.title}吗？`}
                  disabled={!enough || onCooldown}
                  label={label}
                  tone="pink"
                />
              </ShopCard>
            );
          })
        )}
      </section>

      <KidNavBar
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          collectionNavItem(child.theme, slug),
        ]}
      />
    </main>
  );
}
