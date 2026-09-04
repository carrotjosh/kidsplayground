import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { ActionError } from "@/lib/errors";

export const PARENT_SESSION_COOKIE = "parent_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

/** 生成一个 30 天有效期的家长登录会话 token（格式：过期时间戳.签名）。 */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

/** 校验会话 token 的签名与是否过期，proxy 和 API 路由都用这一个函数判断是否已登录。 */
export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = sign(payload);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return false;
  }

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() <= expiresAt;
}

export function verifyParentPassword(password: string): boolean {
  const expected = process.env.PARENT_PASSWORD;
  if (!expected) throw new Error("PARENT_PASSWORD is not set");
  return password === expected;
}

/**
 * 家长后台的 Server Action 在最开始都调用一下这个函数，作为 proxy 之外的第二道保险
 * （Next.js 官方文档明确建议：不要只依赖 Proxy，Server Action 自己也要校验）。
 */
export async function requireParentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PARENT_SESSION_COOKIE)?.value;
  if (!isValidSessionToken(token)) {
    throw new ActionError("请先登录家长后台");
  }
}
