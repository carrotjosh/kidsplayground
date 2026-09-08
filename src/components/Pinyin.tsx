import { pinyin } from "pinyin-pro";

const HAN = /\p{Script=Han}/u;

/**
 * 给每个汉字标上拼音（用 <ruby> 标注，浏览器原生支持，不需要额外 JS）。
 * 非汉字（数字、emoji、标点、字母）原样输出，不会被塞进 ruby 里。
 *
 * 在服务端渲染时就把拼音算好，客户端不需要加载 pinyin 库。
 */
export function Pinyin({ text, className }: { text: string; className?: string }) {
  const chars = [...text];
  // 整句一起转换，pinyin-pro 才能根据上下文正确处理多音字（"重"在"重复"和"重量"里读音不同）。
  // 返回的数组逐字符一一对应（数字、空格、emoji 也各占一项），所以可以直接按下标取。
  const readings = pinyin(text, { type: "array", toneType: "symbol" });

  return (
    <span className={className}>
      {chars.map((char, i) =>
        HAN.test(char) ? (
          <ruby key={i}>
            {char}
            <rp>(</rp>
            <rt>{readings[i] ?? ""}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <span key={i}>{char}</span>
        )
      )}
    </span>
  );
}
