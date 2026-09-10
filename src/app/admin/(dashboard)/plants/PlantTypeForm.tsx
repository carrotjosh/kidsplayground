"use client";

import { useActionState } from "react";

import { createPlantTypeAction } from "./actions";
import { PlantTypeFields } from "./PlantTypeFields";

export function PlantTypeForm() {
  const [error, formAction, isPending] = useActionState(createPlantTypeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 pixel-card bg-white p-5">
      <h2 className="font-semibold">新增植物</h2>

      <PlantTypeFields />

      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="pixel-btn self-start bg-nes-red px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "保存中..." : "新增植物"}
      </button>
    </form>
  );
}
