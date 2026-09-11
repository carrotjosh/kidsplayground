"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { getPrimaryChild } from "@/lib/child";
import { prisma } from "@/lib/db";
import { dailyEarnRate } from "@/lib/economy";
import { ActionError } from "@/lib/errors";

/**
 * 倍数的合法范围。
 *
 * 不是怕算错，是怕手滑：输入框里多打一个 0 就会把玩具从 200 改成 2000，
 * 而这个动作会立刻反映到孩子端。上下限卡在"一次最多翻三倍 / 最多砍到四折"，
 * 真要调这么多就分几次调，中间还能看看孩子的反应。
 */
const MIN_FACTOR = 0.4;
const MAX_FACTOR = 3;

/**
 * 按给定倍数把所有家长可改的价格调一遍。
 *
 * 支持**部分校准**：日薪从 25 涨到 38（漂移 52%）时，不一定要一次涨满——
 * 一次性把玩具从 200 提到 304 对孩子是个不小的打击，分两三次慢慢来更合理。
 *
 * 所以校准后的基准值是 `原基准 × 倍数` 而不是 `当前日薪`：
 * 只调了 15% 就把基准记成 38，等于对自己撒谎说"已经校准到位了"，
 * 下次打开体检页会显示没有漂移，而实际上价格仍然偏便宜 31%。
 * 记成 29（25×1.15）才是真的——页面会如实告诉你还剩多少没调。
 *
 * 零成本的礼物（"今晚吃什么我决定"那类）跳过：它们不是"很便宜"，
 * 是刻意不花阳光的一档，乘任何倍数都应该还是 0。
 */
export async function recalibrateAction(formData: FormData) {
  await requireParentSession();
  const child = await getPrimaryChild();

  const rate = await dailyEarnRate(child.id);
  if (rate <= 0) throw new ActionError("现在一个生效中的任务都没有，先去任务模板加几项");

  // 倍数由页面传入（家长可以只调一部分），但**范围和取整都在服务端重新校验**，
  // 不采信页面传来的数字本身。
  const percent = Number(formData.get("percent"));
  if (!Number.isFinite(percent)) throw new ActionError("请填写一个数字");
  const factor = 1 + percent / 100;
  if (factor < MIN_FACTOR || factor > MAX_FACTOR) {
    throw new ActionError(
      `一次最多调整 ${Math.round((MIN_FACTOR - 1) * 100)}% ~ +${Math.round((MAX_FACTOR - 1) * 100)}%，超出的话请分几次调`
    );
  }
  if (Math.abs(factor - 1) < 0.005) throw new ActionError("填的幅度太小，没有任何价格会变");

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
        priceBaselineRate: scale(child.priceBaselineRate),
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
