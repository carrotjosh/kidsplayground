import { requireParentSession } from "@/lib/auth";
import { effectiveUserId } from "@/lib/child";
import { prisma } from "@/lib/db";

import { WebhookForm } from "./WebhookForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireParentSession();
  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId(session) },
    select: { email: true, notifyWebhookUrl: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">设置</h1>
      <p className="text-sm text-slate-500">当前账号：{user?.email}</p>

      <WebhookForm current={user?.notifyWebhookUrl ?? null} />
    </div>
  );
}
