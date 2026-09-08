import { getDayDetail } from "chinese-days";

/**
 * WORKDAY  上班/上学日（含被调休调成工作日的周末）
 * WEEKEND  普通周末
 * HOLIDAY  法定节假日（春节、国庆等，含调休放假的工作日）
 */
export type DayType = "WORKDAY" | "WEEKEND" | "HOLIDAY";

export type DayTypeInfo = {
  type: DayType;
  holidayName: string | null;
  /** 调休补班：本来是周末，但被国家安排成了工作日 */
  isMakeupWorkday: boolean;
};

/**
 * 按中华人民共和国法定节假日安排判断某一天的类型。
 *
 * chinese-days 的 getDayDetail 返回 { work: boolean, name: string }：
 *   - work=false 且 name 是 "Saturday"/"Sunday" → 普通周末
 *   - work=false 且 name 形如 "National Day,国庆节,3" → 法定节假日
 *   - work=true  且 name 形如 "...,补班" → 调休补班（算工作日）
 *
 * 注意：国务院一般在每年 11~12 月才公布次年的放假安排，所以更远年份的数据
 * 依赖 chinese-days 这个包持续更新——每年记得 npm update chinese-days 一次。
 */
export function getDayType(dateString: string): DayTypeInfo {
  // 本来是不是周末（用来判断"工作日"是不是调休补班来的）
  const weekday = new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
  const fallsOnWeekend = weekday === 0 || weekday === 6;

  let detail: { work: boolean; name: string } | undefined;
  try {
    detail = getDayDetail(dateString);
  } catch {
    detail = undefined;
  }

  if (!detail) {
    // 拿不到数据时退回"按星期判断"，不至于整张日历渲染失败。
    return {
      type: fallsOnWeekend ? "WEEKEND" : "WORKDAY",
      holidayName: null,
      isMakeupWorkday: false,
    };
  }

  if (detail.work) {
    return { type: "WORKDAY", holidayName: null, isMakeupWorkday: fallsOnWeekend };
  }

  // name 是英文星期几 → 普通周末；否则是节假日，中文名在逗号分隔的第二段。
  const parts = detail.name.split(",");
  if (parts.length === 1) {
    return { type: "WEEKEND", holidayName: null, isMakeupWorkday: false };
  }

  return { type: "HOLIDAY", holidayName: parts[1] ?? parts[0], isMakeupWorkday: false };
}
