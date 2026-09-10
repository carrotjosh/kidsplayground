"use client";

/**
 * 校准按钮。改价是一次会影响孩子端所有价格的批量写，必须二次确认——
 * 孩子端的价格昨天还是 500 今天变 760，得是家长明确点过头的。
 */
export function RecalibrateButton({
  action,
  factor,
  count,
}: {
  action: () => Promise<void>;
  factor: number;
  count: number;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `确定把 ${count} 个价格按 ${factor.toFixed(2)}× 全部改一遍吗？孩子端会立刻看到新价格。`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="pixel-btn bg-nes-red px-4 py-2 text-white">
        一键按 {factor.toFixed(2)}× 校准
      </button>
    </form>
  );
}
