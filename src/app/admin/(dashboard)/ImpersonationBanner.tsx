import { stopImpersonatingAction } from "./tenants/actions";

/**
 * 代管状态下常驻顶部的横幅。做得刺眼是故意的——超管很容易忘了自己正在看别人家的数据，
 * 然后把别人的任务模板当成自己的改掉。
 */
export function ImpersonationBanner({ email }: { email: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-nes-black bg-nes-red px-6 py-3">
      <p className="pixel-text-outline text-sm font-bold text-white">
        ⚠️ 你正在以 {email} 的身份查看，所有改动都会落到 TA 的数据上
      </p>
      <form action={stopImpersonatingAction}>
        <button
          type="submit"
          className="pixel-btn bg-white px-3 py-1.5 text-sm font-bold text-nes-red"
        >
          退出代管
        </button>
      </form>
    </div>
  );
}
