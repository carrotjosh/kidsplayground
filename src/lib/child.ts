import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";

/**
 * 家长后台第一版没有"切换孩子"的界面，默认操作最早创建的那一条 Child 记录。
 * 以后如果要支持多个孩子，这里改成从 session/参数里读取 childId 即可，
 * 其余业务逻辑（lib/tasks.ts、lib/rewards.ts 等）都已经是按 childId 参数化的。
 */
export async function getPrimaryChild() {
  const child = await prisma.child.findFirst({ orderBy: { createdAt: "asc" } });
  if (!child) {
    throw new ActionError("还没有创建孩子档案，请先运行 seed 脚本或在数据库里手动创建一条 Child 记录");
  }
  return child;
}

/** 找不到就返回 null，交给调用方决定怎么处理（页面用 notFound()，Server Action 用抛错）。 */
export async function getChildBySlug(slug: string) {
  return prisma.child.findUnique({ where: { slug } });
}
