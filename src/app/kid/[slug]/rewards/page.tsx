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
    // h-dvh + overflow-hidden：孩子端跑在 iPad / 学习机上，整页滚动在触屏上很容易误触，
    // 而且滚下去之后底部那排导航就看不见了。页面框固定成一屏，只让礼物列表自己滚。
    <main className="pixel-sky-bg mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 overflow-hidden p-4 md:max-w-3xl lg:max-w-5xl lg:gap-4 lg:p-6 2xl:max-w-6xl">
      <header className="flex shrink-0 items-center justify-between gap-3">
        <h1 className="pixel-text-outline kid-text text-2xl text-white lg:text-4xl">
          <Pinyin text="礼物商店" /> 🎁
        </h1>
        <PointsBadge balance={balance} />
      </header>

      {/* 和花园页的植物卡片用同一套断点，两页的卡片节奏一致 */}
      {/* min-h-0 是必须的：不写的话 flex 子项不会缩到内容高度以下，overflow 就永远不生效 */}
      <section className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
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
        compact
        items={[
          { href: `/kid/${slug}`, label: "今天我要做的事", emoji: "⬅️", tone: "sky" },
          collectionNavItem(child.theme, slug),
        ]}
      />
    </main>
  );
}
