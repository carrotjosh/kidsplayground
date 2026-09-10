"use client";

import { useActionState, useRef, useState } from "react";

import { deletePlantTypeAction, togglePlantTypeActiveAction, updatePlantTypeAction } from "./actions";
import { PlantTypeFields, type PlantTypeFieldValues } from "./PlantTypeFields";

export function PlantTypeRow({
  plantType,
  aliveCount,
  setSize,
}: {
  plantType: PlantTypeFieldValues & { id: string; active: boolean };
  /** 花园里这种植物现在还活着几棵——决定能不能删 */
  aliveCount: number;
  setSize: number;
}) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, isPending] = useActionState(
    async (prev: string | null, formData: FormData) => {
      const result = await updatePlantTypeAction(plantType.id, prev, formData);
      if (result === null) setEditing(false);
      return result;
    },
    null
  );
  const deleteFormRef = useRef<HTMLFormElement>(null);

  if (editing) {
    return (
      <form action={formAction} className="flex flex-col gap-3 pixel-card bg-amber-50 p-5">
        <h3 className="font-semibold">编辑「{plantType.title}」</h3>
        <p className="text-xs text-slate-500">
          改动只影响之后种下的植物；已经种在花园里的保留原来的名字和图案。
        </p>

        <PlantTypeFields initial={plantType} />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="pixel-btn bg-nes-green px-4 py-2 text-white disabled:opacity-50"
          >
            {isPending ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="pixel-btn bg-white px-4 py-2 text-slate-600"
          >
            取消
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 pixel-card bg-white p-4">
      <div className="min-w-0">
        <p className="font-semibold">
          {plantType.emoji} {plantType.title}（{plantType.cost} 阳光）
          {!plantType.active && <span className="ml-2 text-xs text-slate-400">已下架</span>}
        </p>
        <p className="text-sm text-slate-500">
          花园里活着 {aliveCount} / {setSize} 棵
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="pixel-btn bg-white px-3 py-1 text-sm text-slate-700"
        >
          编辑
        </button>

        <form action={togglePlantTypeActiveAction.bind(null, plantType.id, !plantType.active)}>
          <button
            type="submit"
            className={
              plantType.active
                ? "pixel-btn bg-white px-3 py-1 text-sm text-slate-600"
                : "pixel-btn bg-nes-green px-3 py-1 text-sm text-white"
            }
          >
            {plantType.active ? "下架" : "上架"}
          </button>
        </form>

        <form ref={deleteFormRef} action={deletePlantTypeAction.bind(null, plantType.id)}>
          <button
            type="button"
            // 花园里还有活着的这种植物时不让删：删掉之后那几棵会变成"无主"植物，
            // 继续占着格子却不算进集卡目标，孩子就永远集不齐了。
            disabled={aliveCount > 0}
            title={aliveCount > 0 ? "花园里还有这种植物活着，先用「下架」" : undefined}
            onClick={() => {
              if (
                window.confirm(
                  `确定删除植物「${plantType.title}」吗？\n\n孩子的花园里不再能种，但已经种过的历史记录会保留。\n如果只是暂时不想让孩子种，用「下架」就行。`
                )
              ) {
                deleteFormRef.current?.requestSubmit();
              }
            }}
            className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red disabled:cursor-not-allowed disabled:opacity-40"
          >
            删除
          </button>
        </form>
      </div>
    </div>
  );
}
