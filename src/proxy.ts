import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { PARENT_SESSION_COOKIE, isValidSessionToken } from "@/lib/auth";

// 家长后台的页面和它对应的 Server Action 都是同一个 /admin/* 路由下的 POST 请求，
// 这一个 matcher 就同时覆盖了页面访问和表单提交两种情况。
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(PARENT_SESSION_COOKIE)?.value;
  if (isValidSessionToken(token)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
