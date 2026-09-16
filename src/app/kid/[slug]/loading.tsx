/**
 * 孩子端的即时骨架屏。
 *
 * 解决的是「点了没反应」——不是慢，是**没有反馈**。孩子端首页和图鉴页
 * 服务端要先跑满勤结算 → 升级检查 → 图鉴纪律结算（三步有依赖，拆不开），
 * 实测本机 1.0~1.2 秒。在这之前页面上一个像素都不变：没有骨架、没有转圈、
 * 按钮也不变灰。一年级孩子的反应是再点一下，然后再点一下。
 *
 * Next 的 loading.tsx 会被**预取**（见 docs/01-app/.../loading.md），
 * 所以点下去的一瞬间就换上这一屏，内容再流式填进来。
 *
 * 放在 [slug] 这一层，下面所有子路由（图鉴/礼物/花园/日历/单日/等级）
 * 没有自己的 loading.tsx 就都用它。
 *
 * 结构要和真实页面对齐——顶栏、中间伸缩区、底部导航三段，
 * 高度也照抄（h-11/lg:h-12、KID_BADGE_HEIGHT 那一档）。对不齐的话
 * 内容填进来会跳一下，那比没有骨架还难受。
 */

/** 一块灰白的占位。pixel-card 保证边框和真实卡片一样粗。 */
function Block({ className }: { className: string }) {
  return <div className={`pixel-card animate-pulse bg-white/70 ${className}`} />;
}

export default function KidLoading() {
  return (
    <>
      {/* 顶栏：标题 + 两三个徽章 */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Block className="h-10 w-44 lg:h-12" />
        <div className="flex items-center gap-3">
          <Block className="hidden h-14 w-52 sm:block lg:h-16" />
          <Block className="h-14 w-28 lg:h-16" />
          <Block className="h-14 w-32 lg:h-16" />
        </div>
      </header>

      {/* 中间伸缩区。必须 min-h-0 flex-1，理由同各个页面：
          layout 是 overflow-hidden 的固定一屏，没有伸缩区底部会被裁掉 */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row lg:gap-4">
        <section className="flex min-h-0 flex-1 flex-col gap-1 md:w-[38%] md:max-w-md md:flex-none">
          {/* 和页面里的标题行同高，内容填进来才不跳 */}
          <div className="flex h-11 shrink-0 items-center lg:h-12">
            <Block className="h-7 w-40" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <Block className="h-20 shrink-0" />
            <Block className="h-20 shrink-0" />
            <Block className="h-20 shrink-0" />
            <Block className="h-20 shrink-0" />
          </div>
        </section>

        {/* 窄屏隐藏，和首页两栏的断点保持一致 */}
        <section className="hidden min-h-0 flex-1 flex-col gap-1 md:flex">
          <div className="flex h-11 shrink-0 items-center lg:h-12">
            <Block className="h-7 w-32" />
          </div>
          <Block className="min-h-0 flex-1" />
        </section>
      </div>

      {/* 底部导航 */}
      <div className="flex shrink-0 flex-wrap gap-2 lg:gap-3">
        <Block className="h-12 flex-1 basis-[calc(50%-0.25rem)] sm:basis-0 lg:h-14" />
        <Block className="h-12 flex-1 basis-[calc(50%-0.25rem)] sm:basis-0 lg:h-14" />
      </div>
    </>
  );
}
