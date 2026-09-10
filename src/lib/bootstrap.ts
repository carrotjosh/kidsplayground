import { BallTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { GARDEN_SET_SIZE, GARDEN_SIZE } from "@/lib/garden";

/**
 * 新建孩子档案时预置的默认数据。
 *
 * 放在这里而不是 prisma/seed.ts 里，是因为现在有两个入口会用到同一份默认值：
 * 家长在 /admin/children 建孩子，和开发时跑 npm run db:seed。分成两份迟早会漂移。
 */

const DEFAULT_TEMPLATES = [
  { title: "读书20分钟", subject: "读书", amount: 20, unit: "分钟", emoji: "📖", points: 10, weekdays: [1, 2, 3, 4, 5] },
  { title: "口算10题", subject: "口算", amount: 10, unit: "题", emoji: "🧮", points: 5, weekdays: [1, 2, 3, 4, 5] },
  { title: "跳绳200个", subject: "跳绳", amount: 200, unit: "个", emoji: "🤸", points: 5, weekdays: [0, 1, 2, 3, 4, 5, 6] },
];

const DEFAULT_REWARDS = [
  { title: "看30分钟动画片", emoji: "📺", cost: 20, cooldownDays: 1 },
  { title: "一个小玩具", emoji: "🧸", cost: 50, cooldownDays: 30 },
  { title: "去游乐场玩一次", emoji: "🎠", cost: 100, cooldownDays: 30 },
];

/**
 * 植物**必须正好 4 种**：花园是 4×4 = 16 格，集卡规则是"每种各 GARDEN_SET_SIZE 棵"，
 * 4 × 4 = 16 正好铺满。少于 4 种孩子集齐得太轻松，多于 4 种格子装不下、永远集不齐
 * （见 lib/garden.ts 的 computeGardenProgress.achievable）。改这里前先想清楚那个约束。
 */
const DEFAULT_PLANT_TYPES = [
  { title: "向日葵", emoji: "🌻", cost: 15 },
  { title: "坚果墙", emoji: "🥜", cost: 20 },
  { title: "豌豆射手", emoji: "🟢", cost: 25 },
  { title: "樱桃炸弹", emoji: "🍒", cost: 35 },
];

if (DEFAULT_PLANT_TYPES.length * GARDEN_SET_SIZE !== GARDEN_SIZE) {
  // 模块加载时就炸，而不是等孩子发现花园永远集不齐。
  throw new Error(
    `默认植物有 ${DEFAULT_PLANT_TYPES.length} 种 × 每种 ${GARDEN_SET_SIZE} 棵 ≠ 花园 ${GARDEN_SIZE} 格`
  );
}

/**
 * 精灵球目录。catchPower 是抓取率倍率，价格按倍率拉开档次。
 * 大师球必中（代码里特判 tier === MASTER），所以定价要足够贵——
 * 它是"攒很久换一只想要的传说"的兜底，不是日常消耗品。
 */
const DEFAULT_BALL_TYPES = [
  { tier: BallTier.POKE, title: "精灵球", emoji: "⚪", cost: 5, catchPower: 1 },
  { tier: BallTier.GREAT, title: "超级球", emoji: "🔵", cost: 12, catchPower: 1.6 },
  { tier: BallTier.ULTRA, title: "高级球", emoji: "🟡", cost: 25, catchPower: 2.6 },
  { tier: BallTier.MASTER, title: "大师球", emoji: "🟣", cost: 120, catchPower: 99 },
];

/**
 * 给一个刚建好的孩子铺上默认的任务模板、礼物和植物目录。
 *
 * 每一类都先数一下再写，所以对同一个孩子重复调用是安全的（比如老账号想补齐默认植物）。
 * 不放在一个事务里：三次 createMany 互相独立，中途失败最多是少铺一类，
 * 家长在后台自己加回来即可，不值得为此多占一个事务连接。
 */
export async function seedDefaultsForChild(childId: string) {
  const [templateCount, rewardCount, plantTypeCount, ballTypeCount] = await Promise.all([
    prisma.taskTemplate.count({ where: { childId } }),
    prisma.reward.count({ where: { childId } }),
    prisma.plantType.count({ where: { childId } }),
    prisma.ballType.count({ where: { childId } }),
  ]);

  await Promise.all([
    templateCount === 0
      ? prisma.taskTemplate.createMany({
          data: DEFAULT_TEMPLATES.map((t) => ({ ...t, childId })),
        })
      : null,
    rewardCount === 0
      ? prisma.reward.createMany({ data: DEFAULT_REWARDS.map((r) => ({ ...r, childId })) })
      : null,
    // 两个主题的目录都铺上：主题是随时能切的，切过去时不该看到一个空商店。
    // 反正没启用的主题孩子根本看不到，多这几行数据没有代价。
    plantTypeCount === 0
      ? prisma.plantType.createMany({
          data: DEFAULT_PLANT_TYPES.map((p) => ({ ...p, childId })),
        })
      : null,
    ballTypeCount === 0
      ? prisma.ballType.createMany({ data: DEFAULT_BALL_TYPES.map((b) => ({ ...b, childId })) })
      : null,
  ]);
}

/** 给还没有精灵球目录的老孩子补上（主题功能上线前建的档案）。 */
export async function ensureBallTypes(childId: string) {
  if ((await prisma.ballType.count({ where: { childId } })) > 0) return;
  await prisma.ballType.createMany({ data: DEFAULT_BALL_TYPES.map((b) => ({ ...b, childId })) });
}
