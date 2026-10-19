/**
 * 给分类上线之前的数据补上分类。只填空着的，重复跑是安全的。
 *
 * 用法：npx tsx scripts/backfill-task-category.ts
 *
 * - 模板：按任务名猜（lib/taskCategory.ts 的 guessCategory）
 * - 历史任务：有模板的跟模板走；没有模板的（临时任务、模板已删除）按任务名猜
 *
 * 不回填的话，「更爱做哪类任务」面板要从上线那天起重新攒数据，前几周全是「未分类」。
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { categoryLabel, guessCategory } from "../src/lib/taskCategory";

async function main() {
  const templates = await prisma.taskTemplate.findMany({ where: { category: null } });
  for (const t of templates) {
    const category = guessCategory(t.subject ?? t.title);
    await prisma.taskTemplate.update({ where: { id: t.id }, data: { category } });
    console.log(`模板  ${t.title} → ${categoryLabel(category)}`);
  }

  // 有模板的历史任务：一次性按模板批量更新
  const withTemplate = await prisma.taskTemplate.findMany({
    where: { category: { not: null } },
    select: { id: true, category: true },
  });
  let fromTemplate = 0;
  for (const t of withTemplate) {
    const r = await prisma.dailyTask.updateMany({
      where: { templateId: t.id, category: null },
      data: { category: t.category },
    });
    fromTemplate += r.count;
  }

  // 没有模板的：按名字猜
  const orphans = await prisma.dailyTask.findMany({
    where: { category: null, templateId: null },
    select: { id: true, title: true, subject: true },
  });
  for (const d of orphans) {
    await prisma.dailyTask.update({
      where: { id: d.id },
      data: { category: guessCategory(d.subject ?? d.title) },
    });
  }

  const left = await prisma.dailyTask.count({ where: { category: null } });
  console.log(`\n历史任务：跟模板 ${fromTemplate} 条，按名字猜 ${orphans.length} 条，仍未分类 ${left} 条`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
