import { KidTheme, LedgerType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { LEVELS, levelForEarned, levelTitle } from "@/lib/levelTable";

/**
 * 打卡等级。
 *
 * 解决的是礼物商店**零进度感**这个问题：图鉴有分地区解锁、花园有分级，
 * 唯一真正花家长钱的礼物商店却第一天就全开——新孩子一上来就看到「迪士尼 2500」，
 * 那不是目标，是噪音。等级把大愿望往后藏，等孩子真的攒够了资历再露面，
 * 顺带也把家长的现金支出天然往后推。
 *
 * 等级表和纯计算在 lib/levelTable.ts（客户端组件也要用），这里只放读库的部分。
 */

// 转出一份，服务端代码从这一个入口取就行
export * from "@/lib/levelTable";

/**
 * 只算**打卡挣来的**阳光：完成任务 + 月度满勤奖，减去撤销打卡扣回的。
 *
 * 刻意排除的三类，每一类都有理由：
 * - **花园收获 / 图鉴奖励**：那是玩法内部的循环，不代表多干了活。算进去的话，
 *   花园孩子刷一轮就升级、图鉴孩子净吞 56% 反而升得慢，同一张等级表对两个主题就不公平了。
 * - **家长手动加分**：那是家长给的，不是孩子挣的。真要奖励额外的付出，
 *   应该用「临时任务」——那条路会产生 TASK_COMPLETE，自然计入。
 *
 * 换句话说这个数字回答的是"他到底干了多少活"，不是"多少阳光从他手里过了一遍"。
 */
const COUNTED: LedgerType[] = [LedgerType.TASK_COMPLETE, LedgerType.MONTHLY_BONUS];

/** 累计打卡挣到的阳光（毛收入 − 撤销）。 */
export async function totalEarned(childId: string): Promise<number> {
  const [gross, revoked] = await Promise.all([
    prisma.pointsLedger.aggregate({
      where: { childId, type: { in: COUNTED } },
      _sum: { amount: true },
    }),
    prisma.pointsLedger.aggregate({
      where: { childId, type: LedgerType.TASK_REVOKE },
      _sum: { amount: true },
    }),
  ]);
  // 撤销那条流水本身是负数，直接相加就是净额
  return Math.max(0, (gross._sum.amount ?? 0) + (revoked._sum.amount ?? 0));
}

/**
 * 够条件就升级，返回这次新升到的级数（没升就返回 null）。
 *
 * **只增不减**：算出来比存着的低（撤销打卡把累计值拉回了阈值下）时什么都不做。
 * 掉级对一年级孩子是纯打击，而且"我明明做过那些事"这件事本身也没变。
 *
 * 和图鉴的 checkRegionUnlock、花园的 checkGardenStageUp 同构，
 * 包括调用时机——要在页面渲染之前调，否则新解锁的礼物这一次看不到。
 */
export async function checkLevelUp(
  childId: string
): Promise<{ level: number; title: string; unlocked: string[] } | null> {
  const child = await prisma.child.findUnique({
    where: { id: childId },
    select: { level: true },
  });
  if (!child) return null;

  const target = levelForEarned(await totalEarned(childId));
  if (target <= child.level) return null;

  // 带上原级数做条件：两个请求同时触发时只有一个能改到
  const updated = await prisma.child.updateMany({
    where: { id: childId, level: child.level },
    data: { level: target },
  });
  if (updated.count === 0) return null;

  // 顺带告诉孩子这次开了什么。跨级时把中间几级解锁的也一起报出来。
  // 只查虚拟道具——礼物不做等级解锁（那是家长和孩子谈好的约定）。
  const balls = await prisma.ballType.findMany({
    where: { childId, active: true, unlockLevel: { gt: child.level, lte: target } },
    select: { title: true },
  });

  return { level: target, title: levelTitle(target), unlocked: balls.map((b) => b.title) };
}

/**
 * 等级之路：每一级要多少累计阳光、叫什么、解锁什么道具。
 *
 * 为什么要有这一份：道具锁着但看不到路线图，孩子的体验就只是"东西少了"。
 * 得让他清楚看到"再打多少卡就有新球"、以及尽头在哪儿，锁才会变成动力而不是挫折。
 */
export type LevelRoadmapEntry = {
  level: number;
  title: string;
  need: number;
  unlocks: { title: string; emoji: string | null }[];
  reached: boolean;
  current: boolean;
};

export async function getLevelRoadmap(
  childId: string,
  level: number,
  theme: KidTheme
): Promise<LevelRoadmapEntry[]> {
  // 按主题过滤：花园主题的孩子根本看不到精灵球，路线图上摆一排精灵球是纯误导。
  // （花园的植物走的是另一条线——按收获轮数升级，见 lib/garden.ts 的 GARDEN_STAGES，
  //  等级不该再插一脚，两套门槛叠在一起谁也说不清什么时候能拿到。）
  const balls =
    theme === KidTheme.POKEDEX
      ? await prisma.ballType.findMany({
          where: { childId, active: true },
          select: { title: true, emoji: true, unlockLevel: true },
          orderBy: { cost: "asc" },
        })
      : [];

  return LEVELS.map((lv, i) => ({
    level: i + 1,
    title: lv.title,
    need: lv.need,
    unlocks: balls
      .filter((b) => b.unlockLevel === i + 1)
      .map((b) => ({ title: b.title, emoji: b.emoji })),
    reached: i + 1 <= level,
    current: i + 1 === level,
  }));
}
