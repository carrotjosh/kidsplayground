import { todayDateString } from "@/lib/date";

import { AdhocForm } from "./AdhocForm";

export default function AdhocPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">临时任务</h1>
      <p className="text-sm text-slate-500">
        默认加到今天，如果想安排到未来某一天，改一下日期就行。
      </p>
      <AdhocForm defaultDate={todayDateString()} />
    </div>
  );
}
