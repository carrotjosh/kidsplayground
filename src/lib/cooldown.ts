// 礼物兑换冷却的纯计算/展示逻辑。单独一个文件是因为客户端组件也要用，
// 不能让它顺着 import 把 Prisma 一起打进前端包。

const DAY_MS = 24 * 60 * 60 * 1000;

/** 冷却状态：能不能换、还要等几天、下次可换的时间。 */
export type CooldownState = {
  available: boolean;
  daysLeft: number;
  nextAvailableAt: Date | null;
};

/** 把冷却天数说成人话，孩子端和家长端共用。 */
export function formatCooldown(days: number | null): string {
  if (!days) return "不限次数";
  if (days === 1) return "每天最多一次";
  if (days === 7) return "每周最多一次";
  if (days === 30) return "每月最多一次";
  return `每 ${days} 天最多一次`;
}

export function cooldownStateFrom(
  cooldownDays: number | null,
  lastRedeemedAt: Date | null,
  now: Date = new Date()
): CooldownState {
  if (!cooldownDays || !lastRedeemedAt) {
    return { available: true, daysLeft: 0, nextAvailableAt: null };
  }
  const nextAvailableAt = new Date(lastRedeemedAt.getTime() + cooldownDays * DAY_MS);
  const remainMs = nextAvailableAt.getTime() - now.getTime();
  if (remainMs <= 0) return { available: true, daysLeft: 0, nextAvailableAt: null };
  return { available: false, daysLeft: Math.ceil(remainMs / DAY_MS), nextAvailableAt };
}
