import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Pinyin } from "@/components/Pinyin";
import { listChildrenForKidDevice } from "@/lib/child";

export const dynamic = "force-dynamic";

/**
 * 孩子端的入口：登录后（尤其是勾了"这是孩子的设备"那种）会跳到这里。
 *
 * 只有一个孩子就直接跳到 TA 的页面；有多个孩子（二胎家庭共用一台平板）就让孩子自己点名字。
 * 平板上的桌面图标建议存最终的 /kid/<slug>，这样每次点开直接进自己的页面。
 *
 * 这里刻意不给会话加 childId：同一个家长账号下的兄弟姐妹本来就共用一套登录，
 * 互相能打开对方的页面是可以接受的；少动一处会话结构就少一处出错的地方。
 */
export default async function KidIndexPage() {
  const children = await listChildrenForKidDevice();
  if (children.length === 0) notFound();
  if (children.length === 1) redirect(`/kid/${children[0].slug}`);

  return (
    <main className="pixel-sky-bg flex min-h-dvh w-full flex-col items-center justify-center gap-6 p-6">
      <h1 className="pixel-text-outline kid-text text-3xl text-white lg:text-5xl">
        <Pinyin text="你是谁呀？" />
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-5">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/kid/${child.slug}`}
            className="pixel-card kid-text animate-bounce-slow flex min-w-44 flex-col items-center gap-3 bg-white px-8 py-7 text-center text-2xl text-slate-800 lg:text-3xl"
          >
            <span className="text-6xl lg:text-7xl">🧒</span>
            <Pinyin text={child.name} />
          </Link>
        ))}
      </div>
    </main>
  );
}
