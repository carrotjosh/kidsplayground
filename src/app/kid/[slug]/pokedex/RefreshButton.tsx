"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

/**
 * 有偿刷新按钮。带二次确认——这是要花阳光的，孩子手一滑点掉就亏了。
 * 文案由服务端标好拼音传进来（客户端组件不能用 <Pinyin>，会把字典打进浏览器包）。
 */
export function RefreshButton({
  action,
  disabled,
  label,
  confirmText,
}: {
  action: () => Promise<void>;
  disabled: boolean;
  label: ReactNode;
  confirmText: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (window.confirm(confirmText)) formRef.current?.requestSubmit();
        }}
        className={`pixel-btn kid-text w-full py-2 text-base ${
          disabled ? "cursor-not-allowed bg-slate-300 text-slate-500" : "bg-nes-sky text-white"
        }`}
      >
        🔄 {label}
      </button>
    </form>
  );
}
