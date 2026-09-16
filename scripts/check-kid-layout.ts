/**
 * 孩子端布局 + 字号自检。
 *
 * 用法：npm run check:layout
 *
 * 守三条只在真机上才看得出来、tsc / eslint / next build 全都发现不了的规则。
 *
 * ① **一屏容器归 layout.tsx 管**，页面自己不许再写 h-dvh / min-h-screen。
 *    以前九个页面各写各的，飘出了四种不同的宽度（max-w-5xl / 6xl / 7xl / 无），
 *    结果主页满屏、子页两边大白边。现在容器只有一份。
 *
 * ② 每个页面**必须有一个伸缩区**（min-h-0 + flex-1）。
 *    容器是 overflow-hidden 的固定一屏，没有伸缩区的话内容一超屏就从底部裁掉——
 *    底部那排导航正好在被裁掉的那一截里，孩子就跳不到别的页面了。
 *    真发生过：图鉴页把牌库拆成独立页之后一个 flex-1 都不剩，导航整个消失。
 *
 * ③ 字号只许用语义档（kid-title / kid-body / kid-label / kid-note），
 *    不许再出现裸的 text-xs / text-sm。孩子正在认字，12px 的汉字配 6px 的拼音
 *    等于没标；而 text-sm 曾经在孩子端出现 54 次，纯粹是一路复制粘贴出来的。
 *    例外都在 ALLOW_SMALL 里，每一条都写了为什么。
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const KID_ROOT = "src/app/kid";
const LAYOUT = `${KID_ROOT}/[slug]/layout.tsx`;

/**
 * src/components 里**只有孩子端在用**的那些，字号规则要管到。
 * 判断方式就是查引用：这几个在 src/app/admin 下一次都没出现。
 * 共用的（MonthCalendar / BallSprite / PlantSprite）刻意不列——
 * 家长端是桌面密集表格，套上孩子的字号会把后台撑烂。
 */
const KID_ONLY_COMPONENTS = [
  "ConfirmActionButton",
  "CreatureCard",
  "KidNavBar",
  "LevelBadge",
  "LevelUpBanner",
  "PointsBadge",
  "Ruby",
  "ShopCard",
  "TaskCard",
];

/**
 * 允许保留裸小字号的地方。只有一类能进：**固定尺寸小方块里的数字/符号**，
 * 放大了会把方块撑破，而且本来就不是拿来读的字。
 */
const ALLOW_SMALL: { file: string; why: string }[] = [
  { file: "[slug]/level/page.tsx", why: "等级徽章是 h-10 w-14 的固定方块，里面只有「✓ 3」这样的数字" },
  { file: "components/CreatureCard.tsx", why: "左上角那个 3/5、×2 的计数角标，绝对定位压在图上，放大会盖住宝可梦" },
];

/**
 * 剥掉注释再做模式匹配。
 *
 * 不剥的话，"这一屏是 h-dvh 的"这样一句**说明文字**会被当成代码判违规——
 * 第一版就是这么误报了四次。只用于匹配，不写回文件。
 */
function stripComments(src: string): string {
  return src
    // 块注释换成等量的换行，不能直接删：③ 那一段要靠行号报"第几行还在用 text-sm"，
    // 行数一变，报出来的位置就是错的
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    // (?<!:) 放过 https:// 这种
    .replace(/(?<!:)\/\/.*$/gm, "");
}

/**
 * 要守规矩的文件：page.tsx 和 loading.tsx。
 *
 * loading.tsx 也得算——它渲染在同一个 layout 的 <main> 里，约束一模一样
 * （不能自带容器、不能有 <main>、必须有伸缩区）。只扫 page.tsx 的话，
 * 骨架屏把底部导航顶出屏幕也没人拦。
 */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" || name === "loading.tsx" ? [full] : [];
  });
}

let failures = 0;

// ---- ① 容器 ----------------------------------------------------------------
console.log("① 一屏容器：\n");
const layout = stripComments(readFileSync(LAYOUT, "utf8"));
if (!layout.includes("h-dvh") || !layout.includes("overflow-hidden")) {
  failures += 1;
  console.log(`  ❌ ${LAYOUT} —— 容器丢了 h-dvh / overflow-hidden，孩子端会变成可滚动的长页`);
} else if (/max-w-\w+/.test(layout)) {
  failures += 1;
  console.log(`  ❌ ${LAYOUT} —— 容器加了 max-w，平板上又会出现两边大白边`);
} else {
  console.log(`  ✅ ${LAYOUT}`);
}

// ---- ② 每页一个伸缩区 ------------------------------------------------------
console.log("\n② 每页的伸缩区（保证底部导航不被裁掉）：\n");
for (const file of pages(KID_ROOT).sort()) {
  const src = stripComments(readFileSync(file, "utf8"));
  const label = file.replace(`${KID_ROOT}/`, "");

  // /kid/page.tsx 是"你是谁呀"选择页，在 [slug] 之外，不套这个 layout
  if (!file.includes("[slug]")) {
    console.log(`  ⏭️  ${label} —— 不在 [slug] 下，用的是自己的布局`);
    continue;
  }

  if (src.includes("h-dvh") || src.includes("min-h-screen")) {
    failures += 1;
    console.log(`  ❌ ${label} —— 页面自己又写了一屏容器，会和 layout.tsx 打架`);
    continue;
  }
  if (/<main[\s>]/.test(src)) {
    failures += 1;
    console.log(`  ❌ ${label} —— 页面里有 <main>，会嵌进 layout.tsx 的 <main> 里`);
    continue;
  }

  if (!/min-h-0[^"]*flex-1|flex-1[^"]*min-h-0/.test(src)) {
    failures += 1;
    console.log(`  ❌ ${label} —— 没有伸缩区，内容超屏会把底部导航裁掉`);
  } else {
    console.log(`  ✅ ${label}`);
  }
}

// ---- ③ 字号 ----------------------------------------------------------------
//
// 扫的范围比②大：`src/app/kid` 下的**全部** tsx（含 EncounterBoard 这种就地组件），
// 外加 src/components 里只有孩子端在用的那几个。
// 共用组件（MonthCalendar / BallSprite / PlantSprite）不扫——家长端也在用，
// 那边是桌面密集表格，套孩子的字号会把后台撑烂。
console.log("\n③ 字号只用语义档：\n");
// 前面加 (?<![\w:-]) 是为了放过 sm:text-lg 这种断点前缀和 text-xs-ish 这种自定义名
const SMALL = /(?<![\w:-])text-(xs|sm)(?![\w-])/g;

function allTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return allTsx(full);
    return name.endsWith(".tsx") ? [full] : [];
  });
}

const typeScoped = [
  ...allTsx(KID_ROOT),
  ...KID_ONLY_COMPONENTS.map((n) => `src/components/${n}.tsx`),
].sort();

for (const file of typeScoped) {
  const src = stripComments(readFileSync(file, "utf8"));
  const label = file.replace(`${KID_ROOT}/`, "").replace("src/components/", "components/");
  const hits = [...src.matchAll(SMALL)];
  if (hits.length === 0) continue;

  const allowed = ALLOW_SMALL.find((a) => a.file === label);
  if (allowed) {
    console.log(`  ⏭️  ${label} —— ${hits.length} 处例外：${allowed.why}`);
  } else {
    failures += 1;
    const lines = hits.map((h) => src.slice(0, h.index).split("\n").length);
    console.log(`  ❌ ${label} —— 第 ${lines.join("、")} 行还是裸的 text-xs/text-sm，改用 kid-note / kid-label`);
  }
}

// ---- ④ 顶栏必须能换行 ------------------------------------------------------
//
// 和②同一类毛病，只是换成横向：容器是 overflow-hidden，顶栏一旦超宽
// **不会出滚动条，而是直接把右边裁掉**。首页顶栏在 375px 的手机上是
// 名字 + 日期卡 + 等级 + 阳光 ≈ 545px，硬塞进 351px，阳光总数就那么没了——
// 而且在桌面上怎么看都是好的。
console.log("\n④ 顶栏在窄屏能换行（否则右边会被静默裁掉）：\n");
for (const file of pages(KID_ROOT).sort()) {
  if (!file.includes("[slug]")) continue;
  const src = stripComments(readFileSync(file, "utf8"));
  const label = file.replace(`${KID_ROOT}/`, "");
  const header = src.match(/<header\s+className="([^"]*)"/);
  if (!header) continue;

  const cls = header[1];
  if (cls.includes("flex") && !cls.includes("flex-col") && !cls.includes("flex-wrap")) {
    failures += 1;
    console.log(`  ❌ ${label} —— 顶栏是不换行的 flex 行，窄屏会把右边裁掉`);
  } else {
    console.log(`  ✅ ${label}`);
  }
}

if (failures > 0) {
  console.log(`\n❌ ${failures} 处有问题`);
  process.exit(1);
}
console.log("\n✅ 孩子端布局与字号检查通过");
