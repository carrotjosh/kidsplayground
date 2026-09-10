import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { hasAnyUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** 首页只做分流：没建号 → 建号；没登录 → 登录；孩子设备 → 孩子端；家长 → 后台。 */
export default async function Home() {
  if (!(await hasAnyUser())) redirect("/setup");

  const session = await getSession();
  if (!session) redirect("/login");

  redirect(session.role === "kid" ? "/kid" : "/admin");
}
