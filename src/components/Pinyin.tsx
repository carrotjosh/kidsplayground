import { Ruby } from "@/components/Ruby";
import { annotate } from "@/lib/pinyin";

/**
 * 给每个汉字标上拼音（<ruby> 标注，浏览器原生支持，不需要额外 JS）。
 * 非汉字（数字、emoji、标点、字母）原样输出。
 *
 * **只能在服务端组件里用**：它依赖 pinyin-pro，那是一整本字典，进浏览器包会把构建搞崩。
 * 客户端组件要显示带拼音的文字，用 lib/pinyin 的 annotate() 在服务端算好，
 * 再把结果传过去交给 components/Ruby 渲染。
 */
export function Pinyin({ text, className }: { text: string; className?: string }) {
  return <Ruby annotated={annotate(text)} className={className} />;
}
