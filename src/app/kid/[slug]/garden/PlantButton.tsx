"use client";

import { useRef } from "react";

export function PlantButton({
  plantAction,
  disabled,
  label,
}: {
  plantAction: (formData: FormData) => Promise<void>;
  disabled: boolean;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={plantAction}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (window.confirm("确定要用阳光种下这棵植物吗？")) {
            formRef.current?.requestSubmit();
          }
        }}
        className={
          disabled
            ? "pixel-btn cursor-not-allowed bg-slate-300 px-5 py-3 text-lg font-bold text-slate-500"
            : "pixel-btn bg-nes-green px-5 py-3 text-lg font-bold text-white"
        }
      >
        {label}
      </button>
    </form>
  );
}
