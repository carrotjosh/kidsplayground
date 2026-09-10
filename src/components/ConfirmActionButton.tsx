"use client";

import { useRef } from "react";

/** 按钮配色。种植物用绿、兑换礼物用粉、收获花园用金。 */
const TONE_CLASS = {
  green: "bg-nes-green text-white",
  pink: "bg-nes-pink text-white",
  gold: "bg-nes-yellow text-nes-black",
} as const;

/**
 * 需要二次确认的提交按钮。孩子端每个花阳光/不可逆的动作都套一层 window.confirm，
 * 免得手一滑就把阳光花掉了。种植物、兑换礼物、收获花园共用这一个组件——
 * 之前礼物页和花园页各写了一份，尺寸和圆角都对不上，卡片一排下来高低不齐。
 */
export function ConfirmActionButton({
  action,
  confirmText,
  label,
  disabled = false,
  tone = "green",
}: {
  action: (formData: FormData) => Promise<void>;
  confirmText: string;
  label: string;
  disabled?: boolean;
  tone?: keyof typeof TONE_CLASS;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    // w-full：按钮撑满卡片宽度，一排卡片的按钮左右边缘才能对齐，
    // 不会因为"还差 3 阳光"和"还差 998 阳光"字数不同而宽窄不一。
    <form ref={formRef} action={action} className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (window.confirm(confirmText)) {
            formRef.current?.requestSubmit();
          }
        }}
        className={`pixel-btn kid-text w-full px-3 py-3 text-lg ${
          disabled ? "cursor-not-allowed bg-slate-300 text-slate-500" : TONE_CLASS[tone]
        }`}
      >
        {label}
      </button>
    </form>
  );
}
