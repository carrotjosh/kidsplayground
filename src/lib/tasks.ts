import { LedgerType, ScheduleType, TaskSource, TaskStatus } from "@/generated/prisma/client";
import { ActionError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getDayType } from "@/lib/holidays";
import {
  dateStringToUtcDate,
  todayAsUtcDate,
  todayDateString,
  weekdayOfDateString,
} from "@/lib/date";

// 事务客户端和普通 PrismaClient 共用的最小接口，避免依赖生成器内部具体的类型导出名。
type Db = {
  taskTemplate: typeof prisma.taskTemplate;
  dailyTask: typeof prisma.dailyTask;
  pointsLedger: typeof prisma.pointsLedger;
};

/** 判断某个模板在某一天生不生效。单独抽出来是为了让"这个月一共该打卡几天"能用同一套规则。 */
export function isTemplateDueOn(
  template: { scheduleType: ScheduleType; weekdays: number[] },
  dateString: string
): boolean {
  switch (template.scheduleType) {
    case ScheduleType.WORKDAY:
      return getDayType(dateString).type === "WORKDAY";
    case ScheduleType.HOLIDAY:
      return getDayType(dateString).type === "HOLIDAY";
    case ScheduleType.WEEKDAYS:
    default:
      return template.weekdays.includes(weekdayOfDateString(dateString));
  }
}

/**
 * 确保某一天的周期任务已经落库成 DailyTask（幂等，靠 @@unique([childId, date, templateId])
 * + skipDuplicates）。既用于"今天"的懒生成，也用于夜间结算回填过去缺失的日子——否则孩子
 * 只要不打开 App，那天就不会有任何 DailyTask 记录，会被误判成"安全日"从而逃过僵尸判定。
 */
export async function ensureDailyTasksForDate(db: Db, childId: string, dateString: string) {
  const date = dateStringToUtcDate(dateString);

  // 模板数量很少（家庭场景通常个位数），全部取出来在内存里按生效规则过滤，
  // 比把"法定工作日/节假日"这种需要查日历表的判断塞进 SQL 简单可靠。
  const activeTemplates = await db.taskTemplate.findMany({
    where: { childId, active: true },
  });

  const dueTemplates = activeTemplates.filter((t) => isTemplateDueOn(t, dateString));

  if (dueTemplates.length > 0) {
    await db.dailyTask.createMany({
      data: dueTemplates.map((template) => ({
        childId,
        date,
        title: template.title,
        subject: template.subject,
        amount: template.amount,
        unit: template.unit,
        emoji: template.emoji,
        points: template.points,
        source: TaskSource.TEMPLATE,
        templateId: template.id,
      })),
      skipDuplicates: true,
    });
  }
}

/**
 * 获取"今天"的任务列表：先按需把今天生效的周期性模板补齐成 DailyTask，
 * 再把模板任务和已有的临时任务一起返回。
 *
 * 性能：模板和今天已有的任务并行查（不互相依赖），只有在真的缺任务时才写库。
 * 一天里第一次打开会是 3 次数据库往返，之后每次都只有 2 次——数据库在境外时
 * 一次往返 200ms+，省一次就是省 200ms。
 */
export async function getOrCreateTodayTasks(childId: string) {
  const dateString = todayDateString();
  const date = todayAsUtcDate();
  const weekday = weekdayOfDateString(dateString);
  const { type: dayType } = getDayType(dateString);

  const [activeTemplates, existing] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { childId, active: true } }),
    prisma.dailyTask.findMany({ where: { childId, date }, orderBy: { createdAt: "asc" } }),
  ]);

  const dueTemplates = activeTemplates.filter((template) => {
    switch (template.scheduleType) {
      case ScheduleType.WORKDAY:
        return dayType === "WORKDAY";
      case ScheduleType.HOLIDAY:
        return dayType === "HOLIDAY";
      case ScheduleType.WEEKDAYS:
      default:
        return template.weekdays.includes(weekday);
    }
  });

  const existingTemplateIds = new Set(existing.map((t) => t.templateId).filter(Boolean));
  const missing = dueTemplates.filter((t) => !existingTemplateIds.has(t.id));

  // 今天该有的模板任务都已经生成过了，直接返回，不用再写库、也不用重新查。
  if (missing.length === 0) {
    return existing;
  }

  await prisma.dailyTask.createMany({
    data: missing.map((template) => ({
      childId,
      date,
      title: template.title,
      subject: template.subject,
      amount: template.amount,
      unit: template.unit,
      emoji: template.emoji,
      points: template.points,
      source: TaskSource.TEMPLATE,
      templateId: template.id,
    })),
    skipDuplicates: true,
  });

  return prisma.dailyTask.findMany({
    where: { childId, date },
    orderBy: { createdAt: "asc" },
  });
}

export async function createAdhocTask(params: {
  childId: string;
  date: Date;
  title: string;
  subject?: string | null;
  amount?: number | null;
  unit?: string | null;
  emoji?: string | null;
  points: number;
}) {
  return prisma.dailyTask.create({
    data: {
      childId: params.childId,
      date: params.date,
      title: params.title,
      subject: params.subject ?? null,
      amount: params.amount ?? null,
      unit: params.unit ?? null,
      emoji: params.emoji ?? null,
      points: params.points,
      source: TaskSource.ADHOC,
    },
  });
}

/** 孩子提交打卡待审核：PENDING -> PENDING_REVIEW，不发阳光。对已经是 PENDING_REVIEW
 *  或 DONE 的重复调用是安全的（直接返回），方便前端重复点击不出错。 */
export async function submitDailyTaskForReview(dailyTaskId: string, childId: string) {
  const task = await prisma.dailyTask.findUnique({ where: { id: dailyTaskId } });
  if (!task || task.childId !== childId) {
    throw new ActionError("任务不存在");
  }
  if (task.status === TaskStatus.DONE || task.status === TaskStatus.PENDING_REVIEW) {
    return task;
  }
  if (task.status === TaskStatus.CANCELLED) {
    throw new ActionError("这个任务已经取消了");
  }
  return prisma.dailyTask.update({
    where: { id: dailyTaskId },
    data: { status: TaskStatus.PENDING_REVIEW },
  });
}

/** 家长批准打卡并发放阳光。兼容两种入口：孩子已提交待审核（PENDING_REVIEW）家长审核通过，
 *  或家长直接对 PENDING 的任务"补打卡"跳过审核直接批准。对已 DONE 的重复调用安全（不重复发）。 */
export async function approveDailyTask(dailyTaskId: string, childId: string) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.dailyTask.findUnique({ where: { id: dailyTaskId } });
    if (!task || task.childId !== childId) {
      throw new ActionError("任务不存在");
    }
    if (task.status === TaskStatus.DONE) {
      return task;
    }
    if (task.status === TaskStatus.CANCELLED) {
      throw new ActionError("这个任务已经取消了");
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

/** 家长打回：只能对"待审核"的任务操作，退回 PENDING 让孩子重新提交。
 *  不发也不需要冲销阳光，因为提交待审核阶段本来就没有发过阳光。 */
export async function rejectDailyTaskReview(dailyTaskId: string, childId: string) {
  const task = await prisma.dailyTask.findUnique({ where: { id: dailyTaskId } });
  if (!task || task.childId !== childId) {
    throw new ActionError("任务不存在");
  }
  if (task.status !== TaskStatus.PENDING_REVIEW) {
    throw new ActionError("这个任务不在待审核状态，没法打回");
  }
  return prisma.dailyTask.update({
    where: { id: dailyTaskId },
    data: { status: TaskStatus.PENDING },
  });
}

/** 家长撤销一条已批准的打卡：状态改回待完成，并插入一条负向冲销流水（不删除原记录，保留审计轨迹）。 */
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
