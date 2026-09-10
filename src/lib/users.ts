import { randomBytes, timingSafeEqual } from "crypto";

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
 * 邀请码字符集：去掉了容易看错的 0/O/1/I/L。家长要把码念给朋友或者手打进去，
 * 少一个"这是零还是欧"的来回比多几位熵有用。
 * 32 个字符 × 12 位 ≈ 2^60，爆破不现实。
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 生成形如 K7QM-3XPT-9WRD 的码。分组只是为了好读，校验时会去掉分隔符。 */
function generateCode(): string {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}

/** 输入时容忍大小写、空格和分隔符的差异——孩子家长手打的，别为格式卡人。 */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** 有没有还没被用掉的邀请码。没有 = 注册关闭（默认就是关闭的）。 */
export async function isSignupOpen(): Promise<boolean> {
  return (await prisma.inviteCode.count({ where: { usedAt: null } })) > 0;
}

/** 超管点一下生成一个一次性邀请码。 */
export async function createInviteCode(createdById: string) {
  // 理论上撞不上，真撞上就换一个重试
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    if (await prisma.inviteCode.findUnique({ where: { code } })) continue;
    return prisma.inviteCode.create({ data: { code, createdById } });
  }
  throw new ActionError("生成邀请码失败，请重试");
}

export async function listInviteCodes() {
  return prisma.inviteCode.findMany({
    orderBy: [{ usedAt: "asc" }, { createdAt: "desc" }],
    include: { usedBy: { select: { email: true } } },
  });
}

/** 删掉一个还没用掉的码（发错人了之类）。已经用掉的留着做记录，不给删。 */
export async function revokeInviteCode(id: string) {
  const result = await prisma.inviteCode.deleteMany({ where: { id, usedAt: null } });
  if (result.count === 0) throw new ActionError("这个邀请码已经被用掉了，删不了");
}

/**
 * 找一个还没用掉的、和输入匹配的码。
 *
 * 逐个取出来用等长比较，而不是直接 where code = 输入：数据库的字符串比较会短路，
 * 理论上能通过响应快慢一点点试出正确的码。码只有几十个，全表扫的代价可以忽略。
 */
async function findMatchingCode(provided: string) {
  const normalized = normalizeCode(provided);
  const open = await prisma.inviteCode.findMany({ where: { usedAt: null } });
  for (const row of open) {
    const a = Buffer.from(normalizeCode(row.code));
    const b = Buffer.from(normalized);
    if (a.length === b.length && timingSafeEqual(a, b)) return row;
  }
  return null;
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

/**
 * 凭邀请码注册。普通租户，没有超管权限。
 *
 * 建号和"标记邀请码已用"必须在一个事务里：分开做的话，两个人拿同一个码同时注册
 * 就会都成功，一次性也就名存实亡了。usedByUserId 上的唯一约束是最后一道保险。
 */
export async function createInvitedUser(email: string, password: string, inviteCode: string) {
  const match = await findMatchingCode(inviteCode);
  if (!match) throw new ActionError("邀请码不对，或者已经被用掉了");

  const normalized = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) {
    throw new ActionError("这个邮箱已经注册过了，直接登录吧");
  }
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    // 带上 usedAt: null 条件，两个人抢同一个码时只有一个能改到
    const claimed = await tx.inviteCode.updateMany({
      where: { id: match.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new ActionError("这个邀请码刚刚被用掉了");

    const user = await tx.user.create({
      data: { email: normalized, passwordHash, isSuperAdmin: false },
    });
    await tx.inviteCode.update({ where: { id: match.id }, data: { usedByUserId: user.id } });
    return user;
  });
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
