import { notFound, redirect } from "next/navigation";

import { requireAnySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * 孩子端的入口：登录后（尤其是勾了"这是孩子的设备"那种）会跳到这里，
 * 再转到当前账号名下孩子的实际页面。孩子的平板"添加到主屏幕"时存这个地址就行，
 * 不用记那串 slug。
 */
export default async function KidIndexPage() {
  const session = await requireAnySession();
  const child = await prisma.child.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });
  if (!child) notFound();

  redirect(`/kid/${child.slug}`);
}
