"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string };

/**
 * 家长后台的导航。桌面平铺，手机收进汉堡抽屉。
 *
 * 为什么要分两套：菜单有十来项，原来是一个 flex-wrap 直接铺开——
 * 桌面上是一行，手机上会折成三四行长短不齐的白字，还把整个头部撑得很高，
 * 内容被挤到屏幕下半截。手机上真正要的是"知道我在哪一页"+"能跳到别的页"，
 * 不需要十一项永远摊在眼前。
 *
 * 抽屉里顺带放了退出登录：手机上头部空间紧张，而退出是低频操作。
 */
export function AdminNav({ items, logout }: { items: NavItem[]; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // 路由变了就收起来。Next 的 Link 是客户端跳转、页面不会重新加载，
  // 不主动关的话抽屉会一直盖在新页面上。
  //
  // 用"渲染期调整 state"而不是 useEffect：effect 要等一次额外的渲染才跑，
  // 中间那一帧抽屉是盖着新页面的，会闪一下。React 19 的 lint 也不允许在 effect 里 setState。
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  const active = items.find((item) => isActive(item.href, pathname));

  return (
    <>
      {/* 桌面：整排平铺 */}
      <nav className="hidden flex-wrap gap-4 text-sm font-bold md:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`pixel-text-outline hover:text-nes-yellow ${
              isActive(item.href, pathname) ? "text-nes-yellow" : "text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* 手机：只显示"我在哪一页"，其余收进抽屉 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="菜单"
        className="pixel-btn flex items-center gap-2 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 md:hidden"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
        {active?.label ?? "菜单"}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 border-b-4 border-nes-black bg-nes-brown p-3 md:hidden">
          {/* 两列：十一项排一列要滑很久，两列一屏就能看全 */}
          <nav className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`border-2 border-nes-black px-3 py-2 text-sm font-bold ${
                  isActive(item.href, pathname)
                    ? "bg-nes-yellow text-slate-900"
                    : "bg-white text-slate-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="mt-2">
            <button
              type="submit"
              className="pixel-btn w-full bg-nes-red px-3 py-2 text-sm font-bold text-white"
            >
              退出登录
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/**
 * 判断某一项是不是当前页。
 *
 * "/admin" 要精确匹配——用前缀匹配的话它会在每一页都亮着，
 * 而其它页用前缀匹配才能让 /admin/history 下面的子路由也保持高亮。
 */
function isActive(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}
