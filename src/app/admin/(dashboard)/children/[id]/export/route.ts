import { requireParentSession } from "@/lib/auth";
import { effectiveUserId } from "@/lib/child";
import { prisma } from "@/lib/db";
import { todayDateString } from "@/lib/date";

/**
 * 导出一个孩子名下的全部数据，JSON 下载。给删除前备份用。
 *
 * 表的范围对应 lib/child.ts 的 deleteChild()：两边要改就一起改，
 * 否则导出和删除实际覆盖的数据范围会悄悄对不上。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: childId } = await params;
  const session = await requireParentSession();
  const ownerId = effectiveUserId(session);

  const child = await prisma.child.findFirst({ where: { id: childId, userId: ownerId } });
  if (!child) return new Response("Not found", { status: 404 });

  const [
    taskTemplates,
    dailyTasks,
    pointsLedger,
    rewards,
    redemptions,
    dailyEncounters,
    ballTypes,
    caught,
  ] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { childId } }),
    prisma.dailyTask.findMany({ where: { childId } }),
    prisma.pointsLedger.findMany({ where: { childId } }),
    prisma.reward.findMany({ where: { childId } }),
    prisma.redemption.findMany({ where: { childId } }),
    prisma.dailyEncounter.findMany({ where: { childId } }),
    prisma.ballType.findMany({ where: { childId } }),
    prisma.caught.findMany({ where: { childId } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    child,
    taskTemplates,
    dailyTasks,
    pointsLedger,
    rewards,
    redemptions,
    dailyEncounters,
    ballTypes,
    caught,
  };

  const filename = `kid-checkin-${child.slug}-${todayDateString()}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
