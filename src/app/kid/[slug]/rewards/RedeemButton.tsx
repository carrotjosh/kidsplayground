"use client";

import { useRef } from "react";

export function RedeemButton({
  redeemAction,
  disabled,
  label,
}: {
  redeemAction: (formData: FormData) => Promise<void>;
  disabled: boolean;
  label: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={redeemAction}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (window.confirm("确定要用积分兑换这个礼物吗？")) {
            formRef.current?.requestSubmit();
          }
        }}
        className={
          disabled
            ? "cursor-not-allowed rounded-full bg-slate-200 px-5 py-3 text-lg font-bold text-slate-400"
            : "rounded-full bg-pink-500 px-5 py-3 text-lg font-bold text-white shadow active:scale-95"
        }
      >
        {label}
      </button>
    </form>
  );
}
