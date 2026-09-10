"use server";

import { revalidatePath } from "next/cache";

import { requireParentSession } from "@/lib/auth";
import { effectiveUserId } from "@/lib/child";
import { prisma } from "@/lib/db";
import { sendTestNotification } from "@/lib/notify";

/** 简单校验：必须是 http(s) 的绝对地址，挡住填个手机号之类的低级错误。 */
function parseWebhookUrl(raw: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, url: null }; // 清空 = 关闭推送
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "只支持 http / https 开头的地址" };
    }
    return { ok: true, url: trimmed };
  } catch {
    return { ok: false, error: "这不像一个网址，请粘贴推送服务给你的完整链接" };
  }
}

export async function saveWebhookAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const session = await requireParentSession();

  const parsed = parseWebhookUrl(String(formData.get("webhookUrl") ?? ""));
  if (!parsed.ok) return parsed.error;

  // 保存到"当前生效的账号"上：超管代管期间改的是被代管方的配置，和其它页面语义一致
  await prisma.user.update({
    where: { id: effectiveUserId(session) },
    data: { notifyWebhookUrl: parsed.url },
  });

  revalidatePath("/admin/settings");
  return null;
}

/**
 * 发一条测试通知。这里**要**把错误抛给用户看——webhook 填错了不会有任何其它反馈，
 * 没有测试按钮的话家长会以为配好了，然后一直收不到消息也不知道为什么。
 */
export async function testWebhookAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  await requireParentSession();

  const parsed = parseWebhookUrl(String(formData.get("webhookUrl") ?? ""));
  if (!parsed.ok) return parsed.error;
  if (!parsed.url) return "请先填写推送地址";

  try {
    await sendTestNotification(parsed.url);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `发送失败：${msg.includes("abort") ? "超时，检查地址是否正确" : msg}`;
  }
  return "✅ 已发送，去微信看看收到没有";
}
