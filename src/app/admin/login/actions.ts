"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  PARENT_SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifyParentPassword,
} from "@/lib/auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const password = String(formData.get("password") ?? "");

  if (!verifyParentPassword(password)) {
    return "密码不对哦，再试一次";
  }

  const store = await cookies();
  store.set(PARENT_SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/admin");
}
