/**
 * 孩子端布局自检。
 *
 * 用法：npm run check:layout
 *
 * 守一条只在真机上才看得出来的规则：孩子端每一页都是
 * `h-dvh + overflow-hidden` 的固定一屏，**必须有且只有一个伸缩区**
 * （min-h-0 + flex-1），否则内容一超过屏幕就会从底部被裁掉——
 * 底部那排导航正好在被裁掉的那一截里，孩子就跳不到别的页面了。
 *
 * 真发生过：图鉴页把牌库拆成独立页之后，页面上一个 flex-1 都不剩，
 * 导航整个消失。tsc 和 eslint 都发现不了，构建也照样通过。
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const KID_ROOT = "src/app/kid";

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

let failures = 0;
console.log("检查孩子端每一页是否锁在一屏内且导航不会被裁掉：\n");

for (const file of pages(KID_ROOT).sort()) {
  const src = readFileSync(file, "utf8");
  const label = file.replace(`${KID_ROOT}/`, "");

  // /kid/page.tsx 是"你是谁呀"选择页，内容极少，用的是居中布局，不适用这条规则
  const locked = src.includes("h-dvh") && src.includes("overflow-hidden");
  if (!locked) {
    if (src.includes("min-h-screen")) {
      failures += 1;
      console.log(`  ❌ ${label} —— 还在用 min-h-screen，整页会滚动`);
    } else {
      console.log(`  ⏭️  ${label} —— 不是固定一屏的页面，跳过`);
    }
    continue;
  }

  const hasFlexRegion = /min-h-0[^"]*flex-1|flex-1[^"]*min-h-0/.test(src);
  if (!hasFlexRegion) {
    failures += 1;
    console.log(`  ❌ ${label} —— 锁了一屏却没有伸缩区，内容超屏会把底部导航裁掉`);
  } else if (!src.includes("KidNavBar")) {
    console.log(`  ⏭️  ${label} —— 没有底部导航（可能是特殊页面）`);
  } else {
    console.log(`  ✅ ${label}`);
  }
}

if (failures > 0) {
  console.log(`\n❌ ${failures} 个页面有问题`);
  process.exit(1);
}
console.log("\n✅ 孩子端布局检查通过");
