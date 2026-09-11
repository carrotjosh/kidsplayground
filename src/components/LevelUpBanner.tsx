import { Pinyin } from "@/components/Pinyin";

/**
 * 升级横幅。一次性提示，靠 lib/level.ts 的 checkLevelUp 只在真正升级那一次返回非空来保证。
 *
 * 抽成组件是因为孩子端有三个入口（首页、礼物商店、图鉴/花园）都可能是升级发生的那一刻，
 * 各写一遍迟早会漂移成三套文案。
 */
export function LevelUpBanner({
  levelUp,
}: {
  levelUp: { level: number; title: string; unlocked: string[] };
}) {
  return (
    <p className="pixel-card kid-text bg-nes-yellow p-4 text-center text-slate-900 lg:p-5">
      <Pinyin text={`🎊 升到 ${levelUp.level} 级啦！你现在是「${levelUp.title}」`} />
      {levelUp.unlocked.length > 0 && (
        <>
          <br />
          <Pinyin text={`解锁了：${levelUp.unlocked.join("、")}`} />
        </>
      )}
    </p>
  );
}
