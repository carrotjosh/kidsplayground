"use server";

import { revalidatePath } from "next/cache";

import { requireChildBySlug } from "@/lib/child";
import { throwBall, type ThrowResult } from "@/lib/pokedex";

/**
 * 扔球。和花园里"种植物"不同，这一步是有输赢的，所以要把结果带回页面渲染，
 * 不能只靠 revalidate 让页面自己刷——孩子得知道刚才那一下抓到没抓到、遇到的是谁。
 *
 * 结果通过 useActionState 回传，所以返回值必须是可序列化的普通对象。
 * 参数顺序是为了配合 .bind(null, slug, ballTypeId) —— 绑完之后签名正好是
 * useActionState 要的 (prevState, formData) => newState。
 */
export async function throwBallAction(
  slug: string,
  ballTypeId: string,
  _prevState: ThrowResult | { error: string } | null,
  _formData: FormData
): Promise<ThrowResult | { error: string }> {
  const child = await requireChildBySlug(slug);

  let result: ThrowResult;
  try {
    result = await throwBall(ballTypeId, child.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "出了点问题，再试一次" };
  }

  revalidatePath(`/kid/${slug}/pokedex`);
  revalidatePath(`/kid/${slug}`);
  return result;
}
