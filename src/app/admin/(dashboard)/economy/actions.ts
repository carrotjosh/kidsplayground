"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { dailyEarnRate } from "@/lib/economy";
import { ActionError } from "@/lib/errors";

/**
 * 按当前日薪把所有家长可改的价格等比例校准一遍。
 *
 * 倍数在服务端重算，不采信页面传来的东西——页面上的预览可能是几分钟前渲染的，
 * 期间家长在别的标签页改了任务模板，直接用页面上的数会按过期的倍数改价。
 *
 * 零成本的礼物（"今晚吃什么我决定"那类）跳过：它们不是"很便宜"，
 * 是刻意不花阳光的一档，乘任何倍数都应该还是 0。
 */
export async function recalibrateAction() {
  await requireParentSession();
  const child = await getPrimaryChild();

  const rate = await dailyEarnRate(child.id);
  if (rate <= 0) throw new ActionError("现在一个生效中的任务都没有，先去任务模板加几项");

  const factor = rate / child.priceBaselineRate;
  if (!Number.isFinite(factor) || factor <= 0) throw new ActionError("日薪算不出来，请检查任务模板");

  const scale = (n: number) => Math.max(1, Math.round(n * factor));

  const [rewards, balls, plants] = await Promise.all([
    prisma.reward.findMany({ where: { childId: child.id, cost: { gt: 0 } } }),
    prisma.ballType.findMany({ where: { childId: child.id } }),
    prisma.plantType.findMany({ where: { childId: child.id } }),
  ]);

  // 一个事务里改完：中途失败会让一半价格是新的、一半是旧的，那种状态没人看得懂。
  await prisma.$transaction([
    ...rewards.map((r) =>
      prisma.reward.update({ where: { id: r.id }, data: { cost: scale(r.cost) } })
    ),
    ...balls.map((b) =>
      prisma.ballType.update({ where: { id: b.id }, data: { cost: scale(b.cost) } })
    ),
    ...plants.map((p) =>
      prisma.plantType.update({ where: { id: p.id }, data: { cost: scale(p.cost) } })
    ),
    prisma.child.update({
      where: { id: child.id },
      data: {
        dailyGoalPoints: scale(child.dailyGoalPoints),
        // 记下这套价格是按哪个日薪定的，下次才算得出漂移
        priceBaselineRate: rate,
      },
    }),
  ]);

  revalidatePath("/admin/economy");
  revalidatePath("/admin/rewards");
  revalidatePath("/admin/balls");
  revalidatePath("/admin/plants");
  revalidatePath("/admin/children");
  // 孩子端的商店价格也要跟着变
  revalidatePath(`/kid/${child.slug}`, "layout");
}

/**
 * 不改价，只把基准值对齐到当前日薪——「我知道漂移了，但这套价格我就是要保持」。
 * 没有这个的话体检页会永远挂着一条黄色提示，久了就没人看了。
 */
export async function acceptCurrentPricesAction() {
  await requireParentSession();
  const child = await getPrimaryChild();
  const rate = await dailyEarnRate(child.id);
  if (rate <= 0) throw new ActionError("现在一个生效中的任务都没有，先去任务模板加几项");

  await prisma.child.update({
    where: { id: child.id },
    data: { priceBaselineRate: rate },
  });
  revalidatePath("/admin/economy");
}
