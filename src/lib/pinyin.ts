import { customPinyin, pinyin } from "pinyin-pro";

/**
 * 多音字纠正表。
 *
 * pinyin-pro 靠内置词库判断多音字，词库覆盖不到的组合就会取默认读音，
 * 在这个 App 里"种"尤其容易错——它默认按"种类(zhǒng)"处理，但花园相关的说法
 * 几乎都是"栽种(zhòng)"。孩子正在学认字，标错的拼音等于直接教错读音，所以这里逐条纠正。
 *
 * key 用**词组**而不是单字：单字会无差别覆盖所有出现的地方（"每种植物"的种就该读 zhǒng），
 * 词组才能区分语境。
 *
 * ⚠️ 词组是按字符串匹配的，会跨词边界命中。踩过的坑：加了「种植 → zhòng zhí」之后，
 * 「每种|植物」里的"种植"两个字也被匹配上，把本该读 zhǒng 的"每种"改成了 zhòng。
 * 同理「种花」会误伤「每种花」。所以只加确实需要、且不会跨边界撞车的词组，
 * 加完一定跑 `npm run check:pinyin` 把全部文案过一遍。
 */
const CORRECTIONS: Record<string, string> = {
  // 种 = 栽种，读 zhòng（默认会读成"种类"的 zhǒng）
  种下: "zhòng xià",
  种点: "zhòng diǎn",
  种够: "zhòng gòu",
  种满: "zhòng mǎn",
  可以种: "kě yǐ zhòng",
  去种: "qù zhòng",
  会种: "huì zhòng",
  种一棵: "zhòng yì kē", // 整条写出来，顺便保住"一"在一声字前变调成 yì

  // 句末语气词读轻声 la，默认给的是"哗啦"的 lā
  啦: "la",

  // 系鞋带的系读 jì，不是"关系"的 xì
  系鞋带: "jì xié dài",

  // 宝可梦地区名里的"都"是地名的 dū（同"成都""首都"），默认会读成"都是"的 dōu。
  // key 特意带上"地区"两个字：只写「关都」的话，"这些开关|都打开了"会被跨边界误伤。
  关都地区: "guān dū dì qū",
  城都地区: "chéng dū dì qū",
};

// 模块顶层执行一次即可：pinyin-pro 的自定义词库是全局的，注册之后所有 pinyin() 调用都生效。
customPinyin(CORRECTIONS);

/**
 * 把一段文本转成"每个字符一项"的拼音数组，非汉字（数字、空格、emoji）也各占一项，
 * 所以调用方可以直接按字符下标取对应读音。
 *
 * 整句一起转换而不是逐字转：pinyin-pro 要看上下文才能判断多音字
 * （"重复"和"重量"里的"重"读音不同）。
 */
export function toPinyinArray(text: string): string[] {
  return pinyin(text, { type: "array", toneType: "symbol" });
}

const HAN = /\p{Script=Han}/u;

/**
 * 把文本切成「字 + 读音」的数组，非汉字读音为空串。
 *
 * 这一步必须在**服务端**做（pinyin-pro 带着一整本字典，不能进浏览器包），
 * 算好之后把结果传给客户端组件，用 components/Ruby 渲染。
 */
export function annotate(text: string): { c: string; r: string }[] {
  const chars = [...text];
  const readings = toPinyinArray(text);
  return chars.map((c, i) => ({ c, r: HAN.test(c) ? (readings[i] ?? "") : "" }));
}
