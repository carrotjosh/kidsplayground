import "dotenv/config";

import { prisma } from "../src/lib/db";

async function main() {
  const child = await prisma.child.upsert({
    where: { slug: "pengpeng-demo" },
    update: { name: "蓬蓬" },
    create: {
      name: "蓬蓬",
      slug: "pengpeng-demo",
    },
  });

  const templateCount = await prisma.taskTemplate.count({ where: { childId: child.id } });
  if (templateCount === 0) {
    await prisma.taskTemplate.createMany({
      data: [
        { childId: child.id, title: "读书20分钟", emoji: "📖", points: 10, weekdays: [1, 2, 3, 4, 5] },
        { childId: child.id, title: "口算10题", emoji: "🧮", points: 5, weekdays: [1, 2, 3, 4, 5] },
        { childId: child.id, title: "预习课文", emoji: "📝", points: 5, weekdays: [0, 6] },
      ],
    });
  }

  const rewardCount = await prisma.reward.count({ where: { childId: child.id } });
  if (rewardCount === 0) {
    await prisma.reward.createMany({
      data: [
        { childId: child.id, title: "看30分钟动画片", emoji: "📺", cost: 20 },
        { childId: child.id, title: "一个小玩具", emoji: "🧸", cost: 50 },
        { childId: child.id, title: "去游乐场玩一次", emoji: "🎠", cost: 100 },
      ],
    });
  }

  const plantTypeCount = await prisma.plantType.count({ where: { childId: child.id } });
  if (plantTypeCount === 0) {
    await prisma.plantType.createMany({
      data: [
        { childId: child.id, title: "向日葵", emoji: "🌻", cost: 15 },
        { childId: child.id, title: "坚果墙", emoji: "🥜", cost: 20 },
        { childId: child.id, title: "豌豆射手", emoji: "🟢", cost: 25 },
        { childId: child.id, title: "樱桃炸弹", emoji: "🍒", cost: 35 },
      ],
    });
  }

  console.log(`Seeded child: ${child.name} (slug: ${child.slug})`);
  console.log(`孩子端链接：/kid/${child.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
