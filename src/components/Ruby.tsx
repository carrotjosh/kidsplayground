/**
 * 把「已经算好的」拼音标注渲染成 <ruby>。**故意不 import pinyin-pro**。
 *
 * 为什么要拆出这一层：pinyin-pro 带着一整本字典，在客户端组件里用 <Pinyin> 会把它打进
 * 浏览器包（实测直接把 Turbopack 的产物哈希搞崩、构建失败）。所以规矩是：
 *   - 算拼音（annotate）永远在服务端
 *   - 渲染（这个组件）两边都能用
 * 客户端组件需要带拼音的文字时，让服务端把 Annotated 传过来，或者由 Server Action 返回。
 */
export type Annotated = { c: string; r: string }[];

export function Ruby({ annotated, className }: { annotated: Annotated; className?: string }) {
  return (
    <span className={className}>
      {annotated.map((item, i) =>
        item.r ? (
          <ruby key={i}>
            {item.c}
            <rp>(</rp>
            <rt>{item.r}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{item.c}</span>
        )
      )}
    </span>
  );
}
