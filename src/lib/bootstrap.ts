import { BallTier } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { GARDEN_SET_SIZE, GARDEN_SIZE } from "@/lib/garden";

/**
 * 新建孩子档案时预置的默认数据。
 *
 * 放在这里而不是 prisma/seed.ts 里，是因为现在有两个入口会用到同一份默认值：
 * 家长在 /admin/children 建孩子，和开发时跑 npm run db:seed。分成两份迟早会漂移。
 */

/**
 * 默认任务：每天满分 25 阳光。
 *
 * 数字取这个量级是为了**分辨率**——日收入只有个位数时，"半天的东西"根本定不出价，
 * 所有奖励只能挤在 1~10 之间。25/天之后奖励才排得开档次（见下面的 DEFAULT_REWARDS）。
 * 顺带孩子看到"今天赚了 25"也比"赚了 4"有感觉。
 *
 * 三项里留一项小的（跳绳 5），配合达标线 20 —— 漏掉最小的那项仍然算达标，
 * 不至于漏一项就前功尽弃。
 */
const DEFAULT_TEMPLATES = [
  { title: "读书20分钟", subject: "读书", amount: 20, unit: "分钟", emoji: "📖", points: 10, weekdays: [1, 2, 3, 4, 5, 6, 0] },
  { title: "口算10题", subject: "口算", amount: 10, unit: "题", emoji: "🧮", points: 10, weekdays: [1, 2, 3, 4, 5, 6, 0] },
  { title: "跳绳200个", subject: "跳绳", amount: 200, unit: "个", emoji: "🤸", points: 5, weekdays: [1, 2, 3, 4, 5, 6, 0] },
];

/** 默认每日达标线：25 分里拿到 20 就算达标（可以漏掉最小的那项）。 */
export const DEFAULT_DAILY_GOAL = 20;

/**
 * 默认礼物，按"日收入 25"排的档次：日常(半天~1天) / 周(5~6天) / 月(20~24天) / 学期(100天)。
 *
 * **前三个是零成本的**，这是控制家长现金支出最有效的一条：孩子的阳光会大量消耗在
 * "今晚吃什么我决定"这类不花钱但他很在乎的事情上，掏钱的项自然被挤到低频。
 * 光靠调价控制支出效果差得多（涨价打击积极性），冷却天数才是真正锁住月支出上限的旋钮。
 */
const DEFAULT_REWARDS = [
  { title: "看30分钟动画片", emoji: "📺", cost: 15, cooldownDays: 1 },
  { title: "今晚吃什么我决定", emoji: "🍜", cost: 20, cooldownDays: 1 },
  { title: "周末去哪玩我决定", emoji: "🗺️", cost: 40, cooldownDays: 7 },
  { title: "买一本新书", emoji: "📚", cost: 120, cooldownDays: 14 },
  { title: "去餐厅吃饭", emoji: "🍕", cost: 150, cooldownDays: 7 },
  { title: "一个小玩具", emoji: "🧸", cost: 500, cooldownDays: 30 },
  { title: "去游乐场玩一次", emoji: "🎠", cost: 600, cooldownDays: 30 },
];

/**
 * 植物**必须正好 4 种**：花园是 4×4 = 16 格，集卡规则是"每种各 GARDEN_SET_SIZE 棵"，
 * 4 × 4 = 16 正好铺满。少于 4 种孩子集齐得太轻松，多于 4 种格子装不下、永远集不齐
 * （见 lib/garden.ts 的 computeGardenProgress.achievable）。改这里前先想清楚那个约束。
 */
const DEFAULT_PLANT_TYPES = [
  { title: "向日葵", emoji: "🌻", cost: 8 },
  { title: "坚果墙", emoji: "🥜", cost: 12 },
  { title: "豌豆射手", emoji: "🟢", cost: 18 },
  { title: "樱桃炸弹", emoji: "🍒", cost: 30 },
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
  { tier: BallTier.POKE, title: "精灵球", emoji: "⚪", cost: 8, catchPower: 1 },
  { tier: BallTier.GREAT, title: "超级球", emoji: "🔵", cost: 20, catchPower: 1.6 },
  { tier: BallTier.ULTRA, title: "高级球", emoji: "🟡", cost: 45, catchPower: 2.6 },
  { tier: BallTier.MASTER, title: "大师球", emoji: "🟣", cost: 200, catchPower: 99 },
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
