"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession, requireSuperAdmin, setSessionCookie } from "@/lib/auth";
import { createInviteCode, revokeInviteCode } from "@/lib/users";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";

/**
 * 以某个账号的身份查看后台。
 *
 * 只往会话里加一个 impersonatingUserId，**不放宽任何查询条件**——
 * lib/child.ts 的 effectiveUserId 会把归属切过去，下游三十多个调用点和所有
 * childId 校验一行都不用改就自动作用到对方的数据上。
 *
 * requireSuperAdmin 校验的是 session.userId（真人），不是代管后的 id，
 * 所以代管期间再点一次代管，仍然要求真人自己是超管，不存在越权链。
 */
export async function impersonateAction(targetUserId: string) {
  const session = await requireSuperAdmin();

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new ActionError("账号不存在");

  await setSessionCookie({
    userId: session.userId,
    role: "parent",
    // 代管自己就等于没代管，避免横幅一直挂着
    impersonatingUserId: target.id === session.userId ? undefined : target.id,
  });

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/** 退出代管，回到自己的数据。任何家长会话都能调——它只会缩小权限，不会放大。 */
export async function stopImpersonatingAction() {
  const session = await getSession();
  if (!session || session.role !== "parent") throw new ActionError("请先用家长账号登录");

  await setSessionCookie({ userId: session.userId, role: "parent" });
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/**
 * 生成一个一次性邀请码，**并把码返回给页面**。只有超管能点。
 *
 * 返回值是为了让页面能立刻把整段邀请语写进剪贴板。
 * 走 <form action> 的话拿不到返回值，所以页面那边是在 onClick 里直接 await 它——
 * 这样剪贴板写入还处在同一次点击的手势窗口里，浏览器才肯放行。
 */
export async function createInviteCodeAction(): Promise<{ code: string }> {
  const session = await requireSuperAdmin();
  const created = await createInviteCode(session.userId);
  revalidatePath("/admin/tenants");
  return { code: created.code };
}

/** 撤销一个还没用掉的邀请码（发错人了之类）。 */
export async function revokeInviteCodeAction(id: string) {
  await requireSuperAdmin();
  await revokeInviteCode(id);
  revalidatePath("/admin/tenants");
}
