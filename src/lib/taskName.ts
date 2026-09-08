/** 从"主题 + 数值 + 单位"拼出完整任务名，用于流水说明、家长端列表这类纯文本场景。 */
export function composeTaskTitle(subject: string, amount?: number | null, unit?: string | null) {
  return `${subject}${amount ?? ""}${unit ?? ""}`;
}

/** 解析家长表单里填的主题/数值/单位，顺便做校验。数值和单位都是可选的。 */
export function parseTaskFields(formData: FormData):
  | { ok: true; subject: string; amount: number | null; unit: string | null; title: string }
  | { ok: false; error: string } {
  const subject = String(formData.get("subject") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim() || null;

  if (!subject) return { ok: false, error: "请填写任务主题" };

  let amount: number | null = null;
  if (amountRaw) {
    const parsed = Number(amountRaw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "数值要是一个大于 0 的整数，不填就留空" };
    }
    amount = parsed;
  }

  if (unit && amount === null) {
    return { ok: false, error: "填了单位就要填数值" };
  }

  return { ok: true, subject, amount, unit, title: composeTaskTitle(subject, amount, unit) };
}
