import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/login/actions";

// 家长后台每一页都要读最新数据（今日任务、积分、兑换申请……），
// 不能被 next build 当成静态页面预渲染，否则构建时会拿不到真实数据库连接而报错。
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "仪表盘" },
  { href: "/admin/templates", label: "任务模板" },
  { href: "/admin/adhoc", label: "临时任务" },
  { href: "/admin/history", label: "打卡记录" },
  { href: "/admin/points", label: "阳光记录" },
  { href: "/admin/rewards", label: "礼物" },
  { href: "/admin/plants", label: "植物目录" },
  { href: "/admin/redemptions", label: "兑换记录" },
];

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-nes-black bg-nes-brown px-6 py-4">
        <nav className="flex flex-wrap gap-4 text-sm font-bold">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="pixel-text-outline text-white hover:text-nes-yellow"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="pixel-btn bg-nes-red px-3 py-1.5 text-sm font-bold text-white"
          >
            退出登录
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </div>
  );
}
