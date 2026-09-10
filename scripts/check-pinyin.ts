/**
 * 把孩子端所有会被标拼音的中文字面量抠出来，逐字打印读音，方便人工过一遍多音字。
 *
 * 用法：npm run check:pinyin
 *
 * 孩子正在学认字，标错的拼音等于直接教错读音，所以加了新文案之后建议跑一下这个脚本
 * 扫一眼。发现错的就往 src/lib/pinyin.ts 的 CORRECTIONS 里加一条词组。
 *
 * 注意：家长在后台自己输入的礼物名、任务主题不在这里（它们在数据库里，不是源码字面量），
 * 那部分只能靠 CORRECTIONS 里的通用词条兜底。
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";

import { toPinyinArray } from "../src/lib/pinyin";

const HAN = /\p{Script=Han}/u;

function collectLiterals(): Set<string> {
  const files = execSync("grep -rl 'Pinyin\\|KidNavBar' src --include=*.tsx", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

  const found = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");

    // <Pinyin text="..." /> 和 <Pinyin text={`...`} />
    for (const m of source.matchAll(/<Pinyin[\s\S]*?text=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      // 模板串里的 ${...} 换成 N，只关心中文部分
      const text = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, "N");
      if (HAN.test(text)) found.add(text);
    }
    // KidNavBar 的 items 和 STATUS_STYLE 里的 label，最终也会进 Pinyin
    for (const m of source.matchAll(/label: "([^"]*)"/g)) {
      if (HAN.test(m[1])) found.add(m[1]);
    }
  }
  return found;
}

const literals = [...collectLiterals()].sort();
for (const text of literals) {
  const readings = toPinyinArray(text);
  const annotated = [...text]
    .map((char, i) => (HAN.test(char) ? `${char}(${readings[i]})` : char))
    .join("");
  console.log(annotated);
}
console.log(`\n共 ${literals.length} 条文案。请重点核对多音字：种 / 长 / 乐 / 觉 / 系 / 得 / 数 / 空 / 假。`);
