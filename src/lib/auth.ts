import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { ActionError } from "@/lib/errors";

export const SESSION_COOKIE = "kid_checkin_session";
/** 一次登录管一年——孩子的平板"添加到主屏幕"后不应该动不动就要重新登录。 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** parent = 家长本人，能进 /admin；kid = 孩子的设备，只能进 /kid，防止自己批准自己。 */
export type SessionRole = "parent" | "kid";
export type Session = { userId: string; role: SessionRole };

// ---------- 密码哈希 ----------
// 用 Web Crypto 的 PBKDF2 而不是 bcrypt：不需要原生依赖，Node 和 Cloudflare Workers
// 都原生支持，以后换部署平台不用改这块。

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 对 PBKDF2-SHA256 的建议值

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "base64"));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

/** 生成可直接入库的密码哈希，格式：pbkdf2$迭代次数$盐$哈希（都是 base64）。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationsText, saltText, hashText] = stored.split("$");
  if (scheme !== "pbkdf2") return false;

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const expected = Buffer.from(fromBase64(hashText));
  const actual = Buffer.from(await derive(password, fromBase64(saltText), iterations));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ---------- 会话令牌 ----------
// 格式：base64url(JSON载荷).HMAC签名。载荷里带用户 id、角色和过期时间，
// 签名用 SESSION_SECRET，所以客户端改不了角色也伪造不出会话。

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(session: Session): string {
  const payload = Buffer.from(
    JSON.stringify({ ...session, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** 校验签名和有效期，通过就返回会话内容，否则返回 null。proxy 和页面共用这一个函数。 */
export function readSessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const provided = Buffer.from(signature);
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.userId !== "string") return null;
    if (data.role !== "parent" && data.role !== "kid") return null;
    if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return { userId: data.userId, role: data.role };
  } catch {
    return null;
  }
}

// ---------- 页面 / Server Action 侧的读取 ----------

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * 家长后台的 Server Action 开头都调用一下，作为 proxy 之外的第二道校验
 * （Next.js 官方明确建议不要只依赖 Proxy）。孩子设备的受限会话在这里会被拒绝。
 */
export async function requireParentSession(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "parent") {
    throw new ActionError("请先用家长账号登录");
  }
  return session;
}

/** 孩子端用：家长会话和孩子设备会话都放行。 */
export async function requireAnySession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new ActionError("请先登录");
  return session;
}

export async function setSessionCookie(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
