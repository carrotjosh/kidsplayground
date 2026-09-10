import { prisma } from "@/lib/db";

/**
 * 往家长配置的 webhook 推一条通知。
 *
 * 场景：孩子点了"完成"提交待审核、或者申请兑换礼物时，家长需要知道有事要处理。
 * 现在家长只能自己想起来去打开网页看，这个缺口比"在不在微信里"实际得多。
 *
 * 设计上的两条硬规则：
 *  1. **绝不能影响孩子的操作**。推送失败（网址填错、服务挂了、网络超时）都只记日志，
 *     不往外抛——孩子点完成的动作不该因为家长的推送配置有问题而失败。
 *  2. **带超时**。webhook 是外部 HTTP 调用，不设超时的话孩子那边会一直转圈。
 */

const TIMEOUT_MS = 4000;

/**
 * 不同推送服务的请求体格式不一样，按域名判断。
 * 覆盖国内常用的几个；认不出来的就发通用的 {title, content}，
 * 大部分自建/第三方 webhook 都能接。
 */
function buildPayload(url: string, title: string, content: string): unknown {
  if (url.includes("qyapi.weixin.qq.com")) {
    // 企业微信群机器人
    return { msgtype: "text", text: { content: `${title}\n${content}` } };
  }
  if (url.includes("ftqq.com") || url.includes("sctapi") || url.includes("sc.ftqq")) {
    // Server 酱
    return { title, desp: content };
  }
  if (url.includes("pushplus")) {
    return { title, content, template: "txt" };
  }
  if (url.includes("pushdeer")) {
    return { text: title, desp: content, type: "text" };
  }
  if (url.includes("bark") || url.includes("day.app")) {
    return { title, body: content };
  }
  return { title, content };
}

async function post(url: string, title: string, content: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(url, title, content)),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[notify] 推送返回 ${res.status}：${url.slice(0, 60)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 给某个孩子的家长发通知。查不到 webhook 配置就静默跳过（绝大多数情况）。
 *
 * 从 childId 反查到 User：通知是发给"这个孩子的家长"的，多租户下必须顺着归属链走，
 * 不能用什么全局配置。
 */
export async function notifyParent(childId: string, title: string, content: string) {
  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { user: { select: { notifyWebhookUrl: true } } },
    });
    const url = child?.user?.notifyWebhookUrl?.trim();
    if (!url) return;

    await post(url, title, content);
  } catch (error) {
    // 吞掉所有异常：孩子的打卡不能因为家长的推送配置有问题而失败
    console.warn("[notify] 推送失败：", error instanceof Error ? error.message : error);
  }
}

/** 家长在设置页点"发送测试通知"用。这个要把错误抛出来——不然填错了也没反馈。 */
export async function sendTestNotification(url: string) {
  await post(url, "打卡小星星 · 测试通知", "能看到这条就说明配置成功了 🎉");
}
