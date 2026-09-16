/**
 * 家长后台的即时骨架屏。
 *
 * 同 kid/[slug]/loading.tsx：后台每一页都是 force-dynamic，点导航之后
 * 在服务端返回之前页面纹丝不动。仪表盘实测 ~590ms，够让人怀疑是不是没点上。
 *
 * 顶栏导航在 layout 里，不在这一层，所以刷新时它一直在、始终可点——
 * 也就是说这一屏只负责内容区。
 */
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Bar className="h-8 w-40" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="pixel-card flex flex-col gap-3 bg-white p-4">
          <Bar className="h-5 w-32" />
          <Bar className="h-4 w-full max-w-md" />
          <div className="flex gap-2">
            <Bar className="h-9 w-24" />
            <Bar className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
