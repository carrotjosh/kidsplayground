import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/login/actions";
import { getSession } from "@/lib/auth";
import { getActiveChild, listChildren } from "@/lib/child";
import { THEME_META } from "@/lib/theme";
import { prisma } from "@/lib/db";

import { ChildSwitcher } from "./ChildSwitcher";
import { ImpersonationBanner } from "./ImpersonationBanner";

// 家长后台每一页都要读最新数据（今日任务、积分、兑换申请……），
// 不能被 next build 当成静态页面预渲染，否则构建时会拿不到真实数据库连接而报错。
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "仪表盘" },
  { href: "/admin/templates", label: "任务模板" },
  { href: "/admin/adhoc", label: "临时任务" },
  { href: "/admin/history", label: "打卡记录" },
  { href: "/admin/points", label: "阳光记录" },
  { href: "/admin/rewards", label: "礼物商店" },
  { href: "/admin/redemptions", label: "兑换记录" },
  { href: "/admin/children", label: "孩子档案" },
  { href: "/admin/settings", label: "设置" },
];

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // 顶栏要用到的三样东西一次取齐。孩子列表在没有孩子时是空数组（不抛错），
  // 所以新注册的账号也能正常渲染布局、走到 /admin/children 去建档。
  const [childList, user] = await Promise.all([
    session?.role === "parent" ? listChildren() : Promise.resolve([]),
    session ? prisma.user.findUnique({ where: { id: session.userId } }) : Promise.resolve(null),
  ]);
  // getActiveChild 在一个孩子都没有时会抛错，所以只在有孩子的时候问它
  const activeChild = childList.length > 0 ? await getActiveChild() : null;

  const impersonatedEmail = session?.impersonatingUserId
    ? (await prisma.user.findUnique({ where: { id: session.impersonatingUserId } }))?.email
    : null;

  // 收藏玩法那一项按当前孩子的主题显示，不然会同时看到"植物目录"和"精灵球"两个入口，
  // 而其中一个对这个孩子根本不生效。
  const themeMeta = activeChild ? THEME_META[activeChild.theme] : null;
  const withTheme = themeMeta
    ? [
        ...NAV_ITEMS.slice(0, 7),
        { href: themeMeta.adminPath, label: themeMeta.adminLabel },
        ...NAV_ITEMS.slice(7),
      ]
    : NAV_ITEMS;
  const navItems = user?.isSuperAdmin
    ? [...withTheme, { href: "/admin/tenants", label: "账号总览" }]
    : withTheme;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {impersonatedEmail && <ImpersonationBanner email={impersonatedEmail} />}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-nes-black bg-nes-brown px-6 py-4">
        <nav className="flex flex-wrap gap-4 text-sm font-bold">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pixel-text-outline text-white hover:text-nes-yellow"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* 只有一个孩子时不显示切换器，免得白占地方 */}
          {childList.length > 1 && activeChild && (
            <ChildSwitcher options={childList} activeId={activeChild.id} />
          )}
          <form action={logoutAction}>
            <button
              type="submit"
              className="pixel-btn bg-nes-red px-3 py-1.5 text-sm font-bold text-white"
            >
              退出登录
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </div>
  );
}
