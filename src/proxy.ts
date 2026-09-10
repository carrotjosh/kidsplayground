import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, readSessionToken } from "@/lib/auth";

/**
 * 路由守卫。系统上了公网，孩子端也必须登录才能看——光靠"不易猜的链接"不够了。
 *   /admin/*  只有家长会话能进（孩子设备的受限会话会被踢回孩子端）
 *   /kid/*    家长会话和孩子设备会话都能进
 * 登录页、建号页放行。
 *
 * 这里只做粗粒度拦截，具体的数据归属校验在页面和 Server Action 里还会再做一遍
 * （Next.js 官方明确建议不要只依赖 Proxy）。
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 孩子的设备想进家长后台 → 送回孩子端
  if (pathname.startsWith("/admin") && session.role !== "parent") {
    return NextResponse.redirect(new URL("/kid", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/kid/:path*"],
};
