import { getActiveChild, listChildren } from "@/lib/child";

import { ChildForm } from "./ChildForm";
import { ChildRow } from "./ChildRow";
import { DailyGoalForm } from "./DailyGoalForm";
import { ThemePicker } from "./ThemePicker";

export const dynamic = "force-dynamic";

export default async function ChildrenAdminPage() {
  const children = await listChildren();
  // 一个孩子都还没有时 getActiveChild 会抛错，所以这一页（也只有这一页）要能在没有孩子的
  // 情况下渲染——新注册的账号第一件事就是落到这里建档。
  const active = children.length > 0 ? await getActiveChild() : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">孩子档案</h1>

      {children.length === 0 && (
        <p className="pixel-card bg-amber-50 p-4 text-sm text-slate-600">
          👋 还没有孩子档案。先在下面建一个，后台其它页面才有内容可显示。
        </p>
      )}

      <ChildForm />

      {active && <ThemePicker current={active.theme} childName={active.name} />}
      {active && <DailyGoalForm childName={active.name} current={active.dailyGoalPoints} />}

      <div className="flex flex-col gap-3">
        {children.map((child) => (
          <ChildRow
            key={child.id}
            child={{ id: child.id, name: child.name, slug: child.slug }}
            isActive={child.id === active?.id}
            isOnly={children.length === 1}
          />
        ))}
      </div>

      {children.length > 1 && (
        <p className="text-sm text-slate-500">
          后台一次只显示一个孩子的数据。用上面的「切换到 TA」或顶栏的下拉框切换。
        </p>
      )}
    </div>
  );
}
