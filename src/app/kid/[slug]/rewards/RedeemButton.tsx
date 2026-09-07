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
          if (window.confirm("确定要用阳光兑换这个礼物吗？")) {
            formRef.current?.requestSubmit();
          }
        }}
        className={
          disabled
            ? "pixel-btn cursor-not-allowed bg-slate-300 px-5 py-3 text-lg font-bold text-slate-500 lg:px-7 lg:py-4 lg:text-xl"
            : "pixel-btn bg-nes-pink px-5 py-3 text-lg font-bold text-white lg:px-7 lg:py-4 lg:text-xl"
        }
      >
        {label}
      </button>
    </form>
  );
}
