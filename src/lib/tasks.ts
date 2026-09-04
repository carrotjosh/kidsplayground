import { LedgerType, TaskSource, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { todayAsUtcDate, todayWeekday } from "@/lib/date";

/**
 * 获取"今天"的任务列表：先按需把今天生效的周期性模板补齐成 DailyTask（幂等，
 * 靠 @@unique([childId, date, templateId]) + skipDuplicates 防重复生成），
 * 再把模板任务和已有的临时任务一起返回。不用"已存在就直接返回"的早退路径，
 * 是因为临时任务可能先于模板任务存在，早退会漏生成当天的模板任务。
 */
export async function getOrCreateTodayTasks(childId: string) {
  const date = todayAsUtcDate();
  const weekday = todayWeekday();

  const dueTemplates = await prisma.taskTemplate.findMany({
    where: { childId, active: true, weekdays: { has: weekday } },
  });

  if (dueTemplates.length > 0) {
    await prisma.dailyTask.createMany({
      data: dueTemplates.map((template) => ({
        childId,
        date,
        title: template.title,
        emoji: template.emoji,
        points: template.points,
        source: TaskSource.TEMPLATE,
        templateId: template.id,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.dailyTask.findMany({
    where: { childId, date },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAdhocTask(params: {
  childId: string;
  date: Date;
  title: string;
  emoji?: string | null;
  points: number;
}) {
  return prisma.dailyTask.create({
    data: {
      childId: params.childId,
      date: params.date,
      title: params.title,
      emoji: params.emoji ?? null,
      points: params.points,
      source: TaskSource.ADHOC,
    },
  });
}

/** 孩子或家长把任务标记为完成：加分，且对已完成的任务重复调用是安全的（不会重复加分）。 */
export async function completeDailyTask(dailyTaskId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.dailyTask.findUnique({ where: { id: dailyTaskId } });
    if (!task || task.childId !== childId) {
      throw new ActionError("任务不存在");
    }
    if (task.status === TaskStatus.DONE) {
      return task;
    }

    const [updatedTask] = await Promise.all([
      tx.dailyTask.update({
        where: { id: dailyTaskId },
        data: { status: TaskStatus.DONE, completedAt: new Date() },
      }),
      tx.pointsLedger.create({
        data: {
          childId,
          amount: task.points,
          reason: `完成任务：${task.title}`,
          type: LedgerType.TASK_COMPLETE,
          dailyTaskId,
        },
      }),
    ]);

    return updatedTask;
  });
}

/** 家长撤销一条已完成的打卡记录：状态改回待完成，并插入一条负向冲销流水（不删除原记录，保留审计轨迹）。 */
export async function revokeDailyTaskCompletion(dailyTaskId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.dailyTask.findUnique({ where: { id: dailyTaskId } });
    if (!task || task.childId !== childId) {
      throw new ActionError("任务不存在");
    }
    if (task.status !== TaskStatus.DONE) {
      throw new ActionError("该任务还没有完成，不需要撤销");
    }

    const [updatedTask] = await Promise.all([
      tx.dailyTask.update({
        where: { id: dailyTaskId },
        data: { status: TaskStatus.PENDING, completedAt: null },
      }),
      tx.pointsLedger.create({
        data: {
          childId,
          amount: -task.points,
          reason: `撤销打卡：${task.title}`,
          type: LedgerType.TASK_REVOKE,
          dailyTaskId,
        },
      }),
    ]);

    return updatedTask;
  });
}
