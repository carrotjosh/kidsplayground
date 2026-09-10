"use client";

import { useRef } from "react";

import { switchChildAction } from "./children/actions";

/**
 * 顶栏的孩子切换器。选中就直接提交，不用再点一次按钮——切孩子是个高频动作。
 * 「当前是谁」存在 Cookie 里（见 lib/child.ts 的 getActiveChild），所以切换会影响后台所有页面。
 */
export function ChildSwitcher({
  options,
  activeId,
}: {
  options: { id: string; name: string }[];
  activeId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className="flex items-center gap-2">
      <label className="pixel-text-outline text-sm font-bold text-white" htmlFor="child-switcher">
        当前孩子
      </label>
      <select
        id="child-switcher"
        name="childId"
        defaultValue={activeId}
        onChange={(e) => switchChildAction(e.target.value)}
        className="rounded-none border-2 border-nes-black bg-white px-2 py-1 text-sm"
      >
        {options.map((child) => (
          <option key={child.id} value={child.id}>
            {child.name}
          </option>
        ))}
      </select>
    </form>
  );
}
