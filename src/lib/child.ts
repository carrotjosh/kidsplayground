import { cookies } from "next/headers";
import { pinyin } from "pinyin-pro";

import {
  getSession,
  requireAnySession,
  requireParentSession,
  type Session,
} from "@/lib/auth";
import { seedDefaultsForChild } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/errors";

/** 家长后台"当前正在管哪个孩子"。存 Cookie 而不是放进 URL —— 理由见 getActiveChild。 */
const ACTIVE_CHILD_COOKIE = "kid_checkin_active_child";
const ACTIVE_CHILD_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 这次请求实际要操作**谁的**数据。
 *
 * 正常情况就是登录的人自己；超管在 /admin/tenants 点了"以此账号身份查看"之后，
 * 会话里会带上 impersonatingUserId，这里把归属切过去。
 *
 * 注意这个函数只决定"数据属于谁"，不决定"你是谁"——身份判定一律用 session.userId。
 */
export function effectiveUserId(session: Session): string {
  return session.impersonatingUserId ?? session.userId;
}

/**
 * 取当前正在操作的孩子。**整个家长后台唯一决定"在动谁的数据"的地方**，
 * 所有页面和 Server Action 都从这里拿 childId，下游再按 childId 过滤。
 *
 * 为什么"当前孩子"放 Cookie 而不是放进路由（/admin/[childId]/...）：
 * 这个函数有三十多个调用点，全是同一行 `const child = await getActiveChild()`。
 * 用 Cookie 的话它们一个字都不用改，归属过滤集中在下面那句 findFirst 里；
 * 改路由则要动每个页面、每个 Link、每个 revalidatePath。一个"改错就串户"的改动，
 * 面越小越安全。代价是两个标签页没法同时看两个孩子，家用场景可以接受。
 *
 * 安全要点在 findFirst 的 `userId` 条件上：Cookie 是客户端能随便改的，
 * 但改成别人家孩子的 id 会查不到，直接落回"自己名下第一个孩子"。
 */
export async function getActiveChild() {
  const session = await requireParentSession();
  const ownerId = effectiveUserId(session);

  const store = await cookies();
  const wantedId = store.get(ACTIVE_CHILD_COOKIE)?.value;

  if (wantedId) {
    const child = await prisma.child.findFirst({ where: { id: wantedId, userId: ownerId } });
    if (child) return child;
    // 查不到有两种情况：Cookie 是伪造/过期的，或者超管刚切到别人账号、
    // Cookie 里还留着自己孩子的 id。两种都往下走，回落到名下第一个孩子。
  }

  const fallback = await prisma.child.findFirst({
    where: { userId: ownerId },
    orderBy: { createdAt: "asc" },
  });
  if (!fallback) {
    throw new ActionError("还没有创建孩子档案，请先去「孩子档案」页面建一个");
  }
  return fallback;
}

/**
 * getActiveChild 的旧名字。保留别名是为了让三十多个调用点保持原样——
 * 这次改动的重点是归属逻辑，不该被一次大范围的机械重命名淹没。
 */
export const getPrimaryChild = getActiveChild;

/** 当前（或被代管）账号名下的全部孩子。给后台切换器和孩子端的"你是谁"选择页用。 */
export async function listChildren() {
  const session = await requireParentSession();
  return prisma.child.findMany({
    where: { userId: effectiveUserId(session) },
    orderBy: { createdAt: "asc" },
  });
}

/** 孩子端用：列出这台设备所属账号下的孩子（家长会话和孩子设备会话都放行）。 */
export async function listChildrenForKidDevice() {
  const session = await requireAnySession();
  return prisma.child.findMany({
    where: { userId: effectiveUserId(session) },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * 按 slug 找孩子，同时校验这个孩子确实属于当前登录的账号。
 * 光有 slug 不够——系统上了公网，必须防止拿到别人链接就能看别人家数据。
 */
export async function getChildBySlug(slug: string) {
  const session = await getSession();
  if (!session) return null;

  return prisma.child.findFirst({ where: { slug, userId: effectiveUserId(session) } });
}

/** 孩子端的 Server Action 用：确认有会话且这个孩子属于当前账号。 */
export async function requireChildBySlug(slug: string) {
  const session = await requireAnySession();
  const child = await prisma.child.findFirst({
    where: { slug, userId: effectiveUserId(session) },
  });
  if (!child) throw new ActionError("找不到这个孩子");
  return child;
}

/**
 * 把名字转成孩子端链接里的 slug，比如"蓬蓬" → "pengpeng-k3f9x2"。
 * 后缀是必须的：slug 全局唯一，别人家也可能有个叫蓬蓬的孩子。
 * 非中文/字母数字的字符（emoji、标点）直接丢掉，全丢光了就退回 "kid"。
 */
function buildSlug(name: string): string {
  const base =
    pinyin(name, { toneType: "none", type: "array" })
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "kid";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base.slice(0, 24)}-${suffix}`;
}

/**
 * 新建孩子档案，并铺上默认的任务模板 / 礼物 / 植物目录。
 *
 * 预置默认植物不是锦上添花而是必需的：花园的集卡规则要求正好 4 个品种
 * （见 lib/bootstrap.ts），一个植物目录为空的孩子，花园是坏的。
 */
export async function createChildForCurrentUser(name: string) {
  const session = await requireParentSession();
  const ownerId = effectiveUserId(session);

  const trimmed = name.trim();
  if (!trimmed) throw new ActionError("请填写孩子的名字");
  if (trimmed.length > 20) throw new ActionError("名字太长了");

  // slug 带随机后缀，撞车概率极低；真撞上就换一个后缀重试。
  let child = null;
  for (let attempt = 0; attempt < 5 && !child; attempt++) {
    const slug = buildSlug(trimmed);
    if (await prisma.child.findUnique({ where: { slug } })) continue;
    child = await prisma.child.create({ data: { name: trimmed, slug, userId: ownerId } });
  }
  if (!child) throw new ActionError("生成孩子端链接失败，请重试");

  await seedDefaultsForChild(child.id);
  await writeActiveChildCookie(child.id);
  return child;
}

export async function renameChild(childId: string, name: string) {
  const session = await requireParentSession();
  const trimmed = name.trim();
  if (!trimmed) throw new ActionError("请填写孩子的名字");

  const result = await prisma.child.updateMany({
    where: { id: childId, userId: effectiveUserId(session) },
    data: { name: trimmed },
  });
  if (result.count === 0) throw new ActionError("找不到这个孩子");
}

/**
 * 删除孩子档案，连同名下全部数据。
 *
 * 必须按外键依赖顺序删：PointsLedger 同时指向 DailyTask / Redemption / Plant，
 * 所以它得第一个走；Redemption 和 Plant 又分别指向 Reward 和 PlantType。
 * 整个过程包一个事务——删到一半失败会留下一堆挂不上父记录的孤儿行。
 */
export async function deleteChild(childId: string) {
  const session = await requireParentSession();
  const ownerId = effectiveUserId(session);

  const child = await prisma.child.findFirst({ where: { id: childId, userId: ownerId } });
  if (!child) throw new ActionError("找不到这个孩子");

  await prisma.$transaction([
    prisma.pointsLedger.deleteMany({ where: { childId } }),
    prisma.redemption.deleteMany({ where: { childId } }),
    prisma.plant.deleteMany({ where: { childId } }),
    prisma.caught.deleteMany({ where: { childId } }),
    prisma.dailyTask.deleteMany({ where: { childId } }),
    prisma.reward.deleteMany({ where: { childId } }),
    prisma.plantType.deleteMany({ where: { childId } }),
    prisma.ballType.deleteMany({ where: { childId } }),
    prisma.taskTemplate.deleteMany({ where: { childId } }),
    prisma.child.delete({ where: { id: childId } }),
  ]);
}

async function writeActiveChildCookie(childId: string) {
  const store = await cookies();
  store.set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "1",
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_CHILD_MAX_AGE,
  });
}

/** 切换后台当前正在管的孩子。写 Cookie 之前先确认这个孩子确实是自己名下的。 */
export async function setActiveChild(childId: string) {
  const session = await requireParentSession();
  const child = await prisma.child.findFirst({
    where: { id: childId, userId: effectiveUserId(session) },
  });
  if (!child) throw new ActionError("找不到这个孩子");
  await writeActiveChildCookie(child.id);
}
