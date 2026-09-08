import { getSession, requireAnySession, requireParentSession } from "@/lib/auth";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";

/**
 * 家长后台用：取当前登录家长名下的孩子。现在每个账号只有一个孩子，
 * 以后要支持多个孩子时，这里改成从参数/会话里读 childId 即可，
 * 其余业务逻辑（lib/tasks.ts、lib/garden.ts 等）本来就是按 childId 参数化的。
 */
export async function getPrimaryChild() {
  const session = await requireParentSession();
  const child = await prisma.child.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!child) {
    throw new ActionError("还没有创建孩子档案，请先在「孩子档案」页面建一个");
  }
  return child;
}

/**
 * 孩子端用：按 slug 找孩子，同时校验这个孩子确实属于当前登录的账号。
 * 光有 slug 不够——系统上了公网，必须防止拿到别人链接就能看别人家数据。
 * 找不到或不属于当前账号都返回 null，交给调用方 notFound()。
 */
export async function getChildBySlug(slug: string) {
  const session = await getSession();
  if (!session) return null;

  return prisma.child.findFirst({ where: { slug, userId: session.userId } });
}

/** 孩子端的 Server Action 用：确认有会话且这个孩子属于当前账号。 */
export async function requireChildBySlug(slug: string) {
  const session = await requireAnySession();
  const child = await prisma.child.findFirst({ where: { slug, userId: session.userId } });
  if (!child) throw new ActionError("找不到这个孩子");
  return child;
}
