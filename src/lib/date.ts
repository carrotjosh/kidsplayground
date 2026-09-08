const TIME_ZONE = "Asia/Shanghai";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** 按中国时区返回"今天"的日期字符串，格式 YYYY-MM-DD。所有"今天是哪天"的判断都必须走这个函数。 */
export function todayDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 按中国时区返回今天是星期几：0=周日 ... 6=周六，对应 TaskTemplate.weekdays 的取值。 */
export function todayWeekday(now: Date = new Date()): number {
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(now);
  return WEEKDAY_INDEX[weekdayName];
}

/**
 * 给定 YYYY-MM-DD，返回是星期几（0=周日...6=周六）。用于回填历史日期的任务，
 * 不能复用 todayWeekday()，那个只能算"现在"。用 UTC 解析：dateStringToUtcDate 产出的是
 * 当天 UTC 零点，取"星期几"这种粒度不会因为 UTC 和 Asia/Shanghai 的 8 小时差而跨天错位。
 */
export function weekdayOfDateString(dateString: string): number {
  const date = dateStringToUtcDate(dateString);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
  return WEEKDAY_INDEX[weekdayName];
}

/** 给 YYYY-MM-DD 字符串加/减天数，返回新的 YYYY-MM-DD。用 UTC 日期对象做加减，没有夏令时问题。 */
export function addDays(dateString: string, days: number): string {
  const date = dateStringToUtcDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatStoredDate(date);
}

/** 把 YYYY-MM-DD 转成 UTC 零点的 Date，用于写入 @db.Date 字段，避免本地时区偏移导致日期错位。 */
export function dateStringToUtcDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

/** 按中国时区计算的"今天"，转换成可直接存入 DailyTask.date 的 Date。 */
export function todayAsUtcDate(now: Date = new Date()): Date {
  return dateStringToUtcDate(todayDateString(now));
}

/** 把用 dateStringToUtcDate 存进数据库的 @db.Date 值，格式化回 YYYY-MM-DD 用于展示。 */
export function formatStoredDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------- 月份相关（日历视图 / 月度满勤奖用）----------

/** 按中国时区返回"这个月"，格式 YYYY-MM。 */
export function currentMonthString(now: Date = new Date()): string {
  return todayDateString(now).slice(0, 7);
}

/** YYYY-MM 是否是合法月份字符串。 */
export function isValidMonthString(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** 给 YYYY-MM 加/减月份，返回新的 YYYY-MM。 */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 某个月有多少天。 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 某个月 1 号是星期几（0=周日...6=周六），用于日历首行左侧留空。 */
export function firstWeekdayOfMonth(month: string): number {
  return weekdayOfDateString(`${month}-01`);
}

/** 列出某个月的全部日期字符串：["2026-09-01", ..., "2026-09-30"]。 */
export function datesInMonth(month: string): string[] {
  const total = daysInMonth(month);
  return Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
