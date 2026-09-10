import { timingSafeEqual } from "crypto";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/errors";

/** 系统里有没有账号。没有就走"第一个账号"的引导流程（那个账号会拿到超管权限）。 */
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

/**
 * 邀请码。配在环境变量里，发给朋友；想停止新增就改掉或删掉这个变量。
 *
 * 没配置 = 注册关闭。这是刻意的默认值：忘了配不会变成"对全网开放注册"。
 */
function getInviteCode(): string | null {
  const code = process.env.INVITE_CODE?.trim();
  return code ? code : null;
}

export function isSignupOpen(): boolean {
  return getInviteCode() !== null;
}

/**
 * 校验邀请码。用等长比较避免通过响应快慢逐字符试出正确的码。
 * 长度不同直接判错（长度本身不算秘密，泄露它无所谓）。
 */
function inviteCodeMatches(provided: string): boolean {
  const expected = getInviteCode();
  if (!expected) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function createUser(email: string, password: string, isSuperAdmin: boolean) {
  const normalized = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) {
    throw new ActionError("这个邮箱已经注册过了，直接登录吧");
  }
  return prisma.user.create({
    data: { email: normalized, passwordHash: await hashPassword(password), isSuperAdmin },
  });
}

/**
 * 创建系统里的第一个账号。它自动成为超级管理员（运维这套系统的人）。
 *
 * 历史上这里还会把 userId 为空的孩子认领过来，那是"环境变量密码时代"的数据迁移遗留。
 * 现在 Child.userId 已经是必填的，那段逻辑既是死代码、又是个后门
 * （注册开放后会变成"第二个注册的人自动继承任何无主孩子"），所以删掉了。
 */
export async function createFirstUser(email: string, password: string) {
  if (await hasAnyUser()) {
    throw new ActionError("已经有账号了，请直接登录");
  }
  return createUser(email, password, true);
}

/** 凭邀请码注册。普通租户，没有超管权限。 */
export async function createInvitedUser(email: string, password: string, inviteCode: string) {
  if (!isSignupOpen()) {
    throw new ActionError("现在没有开放注册");
  }
  if (!inviteCodeMatches(inviteCode)) {
    throw new ActionError("邀请码不对");
  }
  return createUser(email, password, false);
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
