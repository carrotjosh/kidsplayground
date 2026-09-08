import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/errors";

/** 系统里有没有账号。没有就走首次建号流程，有了注册入口就关闭（当前只给自家用）。 */
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}

/**
 * 创建第一个家长账号，并把建号之前就存在的孩子档案认领过来
 * （从"环境变量密码"时代升级上来的数据，Child.userId 是空的）。
 */
export async function createFirstUser(email: string, password: string) {
  if (await hasAnyUser()) {
    throw new ActionError("已经有账号了，请直接登录");
  }

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash: await hashPassword(password) },
  });

  await prisma.child.updateMany({ where: { userId: null }, data: { userId: user.id } });

  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // 即使邮箱不存在也跑一次哈希校验，避免用响应快慢探测出哪些邮箱注册过。
  const ok = await verifyPassword(password, user?.passwordHash ?? "pbkdf2$1$AA==$AA==");
  return user && ok ? user : null;
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ActionError("账号不存在");
  if (!(await verifyPassword(current, user.passwordHash))) {
    throw new ActionError("当前密码不对");
  }
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next) },
  });
}
