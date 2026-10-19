// 只取类型：这个文件客户端组件也要用（表单、列表的标签），
// 引 Prisma Client 的运行时值会把整个 Prisma 拖进浏览器包。
import type { TaskCategory } from "@/generated/prisma/client";

/**
 * 任务分类。用来回答家长的问题：「孩子比较喜欢完成什么样的任务」。
 *
 * 为什么是固定的几类而不是自由填写：分类是拿来**统计**的，自由填写会出现
 * 「学习」「学习类」「作业」三个桶，统计就失去意义了。
 *
 * 为什么有「生活习惯」：用户提的例子是学习、运动、家务，但蓬蓬实际的 11 个模板里
 * 有 4 个是早睡、大便、光盘这类——它们既不是学习也不是家务，硬塞进任何一类都会
 * 把那一类的完成率带偏。「阅读」单独拿出来，是因为一年级最想知道的就是他读不读书。
 */
export const CATEGORY_ORDER: TaskCategory[] = [
  "STUDY",
  "READING",
  "SPORT",
  "CHORE",
  "HABIT",
  "ART",
  "OTHER",
];

export const CATEGORY_META: Record<TaskCategory, { label: string; emoji: string; color: string }> = {
  STUDY: { label: "学习", emoji: "✏️", color: "bg-sky-500" },
  READING: { label: "阅读", emoji: "📖", color: "bg-indigo-500" },
  SPORT: { label: "运动", emoji: "🤸", color: "bg-nes-green" },
  CHORE: { label: "家务", emoji: "🧹", color: "bg-amber-500" },
  HABIT: { label: "生活习惯", emoji: "⏰", color: "bg-teal-500" },
  ART: { label: "才艺", emoji: "🎹", color: "bg-pink-500" },
  OTHER: { label: "其他", emoji: "⭐", color: "bg-slate-400" },
};

export function categoryLabel(category: TaskCategory | null | undefined): string {
  return category ? CATEGORY_META[category].label : "未分类";
}

/**
 * 从表单里读分类。表单来的值不可信，只认上面这几个；没选或者乱填都返回错误，
 * 而不是悄悄归到「其他」——那样统计里「其他」会越积越多，没人知道为什么。
 */
export function parseCategory(
  formData: FormData
): { ok: true; category: TaskCategory } | { ok: false; error: string } {
  const raw = String(formData.get("category") ?? "");
  if ((CATEGORY_ORDER as string[]).includes(raw)) return { ok: true, category: raw as TaskCategory };
  return { ok: false, error: "请选择任务分类" };
}

/**
 * 按任务名猜分类。**只用于给老数据回填**，以及新建任务时的默认勾选建议——
 * 不会替家长做最终决定，表单里随时能改。
 *
 * 关键词按蓬蓬实际的模板整理的；猜不出来就是 OTHER。
 */
export function guessCategory(name: string): TaskCategory {
  const rules: [TaskCategory, RegExp][] = [
    ["READING", /读书|阅读|绘本|故事|朗读|看书|RAZ/i],
    ["SPORT", /跳绳|跑步|运动|游泳|篮球|足球|骑车|拍球|体能|仰卧|俯卧|跳远/],
    ["CHORE", /放碗|洗碗|扫地|拖地|家务|整理|收拾|叠|倒垃圾|擦桌|浇花/],
    ["HABIT", /睡觉|起床|刷牙|大便|洗澡|光盘|吃饭|喝水|早睡|洗脸|收书包/],
    ["ART", /钢琴|练琴|画画|美术|唱歌|舞蹈|书法|乐器|小提琴|吉他/],
    ["STUDY", /数学|口算|数感|作业|练字|写字|抄写|英语|英文|多邻国|单词|生字|语文|拼音|练习|默写|背诵/],
  ];
  for (const [category, re] of rules) if (re.test(name)) return category;
  return "OTHER";
}
