"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PARENT_SESSION_COOKIE } from "@/lib/auth";

export async function logoutAction() {
  const store = await cookies();
  store.delete(PARENT_SESSION_COOKIE);
  redirect("/admin/login");
}
