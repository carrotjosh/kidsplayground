"use client";

import { useRef } from "react";

/** 删除是不可逆操作，点一下先弹确认，避免家长误触把模板删掉。 */
export function DeleteTemplateButton({
  deleteAction,
  title,
}: {
  deleteAction: (formData: FormData) => Promise<void>;
  title: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={deleteAction}>
      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              `确定删除任务模板「${title}」吗？\n\n以后不会再自动生成这个任务，但已经打过卡的历史记录会保留。`
            )
          ) {
            formRef.current?.requestSubmit();
          }
        }}
        className="pixel-btn bg-white px-3 py-1 text-sm text-nes-red"
      >
        删除
      </button>
    </form>
  );
}
