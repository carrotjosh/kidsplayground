import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { impersonateAction } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "—";
}

export default async function TenantsAdminPage() {
  // 这一页在 proxy 之外再自己校验一次超管身份（Next.js 官方也建议不要只依赖 Proxy）。
  // 校验不过会抛 ActionError，由 (dashboard)/error.tsx 兜住。
  const session = await requireSuperAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      children: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      },
    },
  });

  // "最近活跃"用最后一条阳光流水的时间估算——打卡、兑换、种植物都会产生流水，
  // 比单纯看登录时间更能反映这家人还在不在用。一次 groupBy 拿全，不要每个账号查一次。
  const lastActivity = await prisma.pointsLedger.groupBy({
    by: ["childId"],
    _max: { createdAt: true },
  });
  const activityByChild = new Map(lastActivity.map((row) => [row.childId, row._max.createdAt]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">账号总览</h1>
      <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
        这些家庭的数据都存在你的数据库里。「以此账号身份查看」会让整个后台切换成对方的数据，
        用完记得点顶部横幅上的「退出代管」。别人的隐私对你是敞开的，建议提前告知他们。
      </p>

      <div className="flex flex-col gap-3">
        {users.map((user) => {
          const latest = user.children
            .map((c) => activityByChild.get(c.id))
            .filter((d): d is Date => Boolean(d))
            .sort((a, b) => b.getTime() - a.getTime())[0];
          const isSelf = user.id === session.userId;

          return (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 pixel-card bg-white p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {user.email}
                  {user.isSuperAdmin && (
                    <span className="ml-2 text-xs text-nes-red">超级管理员</span>
                  )}
                  {isSelf && <span className="ml-2 text-xs text-slate-400">（你自己）</span>}
                </p>
                <p className="text-sm text-slate-500">
                  注册于 {formatDate(user.createdAt)} · 孩子{" "}
                  {user.children.length > 0
                    ? user.children.map((c) => c.name).join("、")
                    : "（还没建档）"}{" "}
                  · 最近活跃 {formatDate(latest)}
                </p>
              </div>

              {!isSelf && (
                <form action={impersonateAction.bind(null, user.id)}>
                  <button
                    type="submit"
                    className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
                  >
                    以此账号身份查看
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
