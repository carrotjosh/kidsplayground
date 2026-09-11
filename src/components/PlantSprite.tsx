/**
 * 植物插画。原创手绘 SVG，走《植物大战僵尸》那种"粗黑描边 + 大眼睛"的卡通风格，
 * 但不是游戏原素材——原版美术是 EA/PopCap 的，不能直接拿来用。
 *
 * 用 SVG 不用位图的三个原因：
 *   1. 花园格子、商店卡片、以后可能的其它尺寸，同一份图任意放大都不糊；
 *   2. 不用往仓库里塞几百 KB 的图片，也不用管 CDN；
 *   3. 配色直接引用站内 NES 色板，和整体风格自然对得上。
 *
 * 认哪种植物用哪张图：按 title 里的关键词匹配。家长自己新增的植物（比如"火爆辣椒"）
 * 匹配不到就退回显示 emoji，不会开天窗。
 */

const OUTLINE = "#101010";

/** 关键词 → 画法。顺序有意义：先匹配到的先用，所以别把"豆"这种太泛的词放前面。 */
const SPRITES: { match: RegExp; render: () => React.ReactNode }[] = [
  { match: /向日葵|太阳花|阳光花/, render: Sunflower },
  { match: /坚果|土豆雷|墙/, render: WallNut },
  // 寒冰要排在"射手"前面，否则「寒冰射手」会被下面那条截胡，画出一样的绿脑袋
  { match: /寒冰|冰冻|冰/, render: IcePeashooter },
  { match: /豌豆|射手/, render: Peashooter },
  { match: /樱桃|炸弹|辣椒/, render: CherryBomb },
  { match: /大嘴|食人|血盆/, render: Chomper },
  { match: /玉米|投手|加农/, render: KernelPult },
];

export function PlantSprite({
  title,
  emoji,
  className = "",
  /**
   * 浮动动画的相位偏移（秒）。花园里给每个格子传不同的值，植物就会此起彼伏地飘，
   * 而不是十六棵整整齐齐一起上下——后者看着像贴纸，前者才像活的。
   */
  floatDelay = 0,
}: {
  title: string;
  emoji: string | null;
  className?: string;
  floatDelay?: number;
}) {
  const sprite = SPRITES.find((s) => s.match.test(title));

  return (
    <span
      className={`animate-float inline-flex items-center justify-center ${className}`}
      // 负数延迟 = 动画从周期中间开始播，不用等就已经错开了相位。
      // toFixed(2)：调用方传的是 i * 0.35 这类算出来的值，不修一下会出现 -1.0499999999999998s。
      style={{ "--float-delay": `${(-floatDelay).toFixed(2)}s` } as React.CSSProperties}
    >
      {sprite ? (
        <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-label={title}>
          {sprite.render()}
        </svg>
      ) : (
        // 家长自定义的植物没有专属插画，就把它选的 emoji 放大顶上。
        <span className="text-[0.9em] leading-none">{emoji ?? "🌱"}</span>
      )}
    </span>
  );
}

/** 茎 + 两片叶子，向日葵和豌豆射手共用。先画黑色粗线做描边，再盖上绿色。 */
function Stem({ x = 32, top = 30 }: { x?: number; top?: number }) {
  return (
    <>
      <path d={`M${x} ${top} V58`} stroke={OUTLINE} strokeWidth="11" strokeLinecap="round" />
      <path d={`M${x} ${top} V58`} stroke="#1a9b28" strokeWidth="6.5" strokeLinecap="round" />
      <ellipse
        cx={x - 12}
        cy="45"
        rx="10"
        ry="5.5"
        fill="#22b833"
        stroke={OUTLINE}
        strokeWidth="3"
        transform={`rotate(-22 ${x - 12} 45)`}
      />
      <ellipse
        cx={x + 12}
        cy="52"
        rx="9"
        ry="5"
        fill="#22b833"
        stroke={OUTLINE}
        strokeWidth="3"
        transform={`rotate(22 ${x + 12} 52)`}
      />
    </>
  );
}

/** 一只大眼睛：白眼球 + 黑瞳孔 + 一点高光。 */
function Eye({ cx, cy, r = 4.2 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke={OUTLINE} strokeWidth="2" />
      <circle cx={cx + r * 0.15} cy={cy + r * 0.2} r={r * 0.5} fill={OUTLINE} />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.18} fill="#ffffff" />
    </>
  );
}

function Sunflower() {
  return (
    <>
      <Stem />
      {/* 12 片花瓣绕着脸转一圈 */}
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse
          key={i}
          cx="32"
          cy="13"
          rx="5.2"
          ry="8.5"
          fill="#fbd000"
          stroke={OUTLINE}
          strokeWidth="2.6"
          transform={`rotate(${i * 30} 32 28)`}
        />
      ))}
      <circle cx="32" cy="28" r="12" fill="#f0a000" stroke={OUTLINE} strokeWidth="3" />
      <Eye cx={27} cy={26} />
      <Eye cx={37} cy={26} />
      <path
        d="M26.5 33.5 Q32 38.5 37.5 33.5"
        stroke={OUTLINE}
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

function WallNut() {
  return (
    <>
      {/* 矮胖的坚果轮廓：宽 > 高，才不会看成一颗蛋 */}
      <path
        d="M32 10 C49 10 57 23 57 37 C57 51 46 58 32 58 C18 58 7 51 7 37 C7 23 15 10 32 10 Z"
        fill="#e3a96a"
        stroke={OUTLINE}
        strokeWidth="3"
      />
      {/* 壳上的纹路 */}
      <path
        d="M16 26 Q23 16 34 17"
        stroke="#bd8347"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M47 26 Q52 34 50 44"
        stroke="#bd8347"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <Eye cx={24} cy={34} r={5} />
      <Eye cx={41} cy={34} r={5} />
      <path
        d="M24 45 Q32 52 40 45"
        stroke={OUTLINE}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

function Peashooter() {
  return (
    <>
      <Stem x={26} top={34} />
      {/* 炮口：从脑袋右侧探出去的一节锥形管子。先画它，让脑袋盖住根部，看起来是长在一起的 */}
      <path
        d="M30 12 L53 9 Q61 22 53 35 L30 32 Z"
        fill="#2f9e2f"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* 炮口的洞。没有它，那节管子只是一块贴上去的绿色梯形，看不出是能打豌豆的 */}
      <ellipse cx="53" cy="22" rx="3.6" ry="8.5" fill="#186b18" />
      <circle cx="25" cy="24" r="16" fill="#3fb63f" stroke={OUTLINE} strokeWidth="3" />
      {/* 脑袋上的高光，让它看起来是个球而不是个饼 */}
      <ellipse cx="18" cy="14" rx="5.5" ry="3.4" fill="#6ed46e" transform="rotate(-25 18 14)" />
      <Eye cx={24} cy={24} r={5.2} />
    </>
  );
}

/**
 * 寒冰射手：豌豆射手的冰系版本。
 *
 * 刻意和 Peashooter 共用同一套构图（茎的位置、脑袋大小、炮口角度全都一样），
 * 只换配色并加两片雪花——孩子一眼就能看出"这是射手家族的另一种"，
 * 而不是一株毫无关系的新植物。原版游戏里这两株也正是这个关系。
 */
function IcePeashooter() {
  return (
    <>
      <Stem x={26} top={34} />
      <path
        d="M30 12 L53 9 Q61 22 53 35 L30 32 Z"
        fill="#4aa8d8"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="53" cy="22" rx="3.6" ry="8.5" fill="#1d5e80" />
      <circle cx="25" cy="24" r="16" fill="#71c9ea" stroke={OUTLINE} strokeWidth="3" />
      <ellipse cx="18" cy="14" rx="5.5" ry="3.4" fill="#b8e8f8" transform="rotate(-25 18 14)" />
      {/* 两片小雪花，摆在脑袋外侧的空白处，不挡眼睛 */}
      <Snowflake cx={11} cy={40} r={4} />
      <Snowflake cx={45} cy={48} r={3} />
      <Eye cx={24} cy={24} r={5.2} />
    </>
  );
}

/** 六角雪花：三条交叉的短线。 */
function Snowflake({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g stroke="#dff2fb" strokeWidth="1.8" strokeLinecap="round">
      <path d={`M${cx} ${cy - r} V${cy + r}`} />
      <path d={`M${cx - r * 0.87} ${cy - r * 0.5} L${cx + r * 0.87} ${cy + r * 0.5}`} />
      <path d={`M${cx - r * 0.87} ${cy + r * 0.5} L${cx + r * 0.87} ${cy - r * 0.5}`} />
    </g>
  );
}

/**
 * 大嘴花：一张张开的大嘴，上下各三颗牙。
 *
 * 它是这一套里唯一"会咬"的植物，所以造型上刻意和前面几株拉开——
 * 没有圆脑袋也没有炮口，主体就是那张嘴，两只小眼睛缩在上颚上方。
 */
function Chomper() {
  return (
    <>
      <Stem x={30} top={38} />
      {/* 下颚：一个厚实的碗 */}
      <path
        d="M12 34 Q32 56 52 34 Q32 44 12 34 Z"
        fill="#8e3fb0"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* 嘴里先铺一层深色，牙齿才有东西衬着，不然白牙浮在半空 */}
      <path d="M12 34 Q32 46 52 34 Q32 26 12 34 Z" fill="#4a1560" />
      {/* 上颚向后仰，做出"张大嘴"的角度 */}
      <path
        d="M12 34 Q26 6 52 12 Q40 28 12 34 Z"
        fill="#b055d8"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M20 32 l4 6 l4 -6 M30 31 l4 6 l4 -6 M40 29 l4 6 l4 -6"
        fill="#ffffff"
        stroke={OUTLINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 36 l4 -6 l4 6 M30 37 l4 -6 l4 6 M40 35 l4 -6 l4 6"
        fill="#ffffff"
        stroke={OUTLINE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <Eye cx={24} cy={17} r={3.6} />
      <Eye cx={36} cy={14} r={3.2} />
    </>
  );
}

/**
 * 玉米投手：一根斜架起来的玉米棒，像门小炮。
 *
 * 和前面几株的区别在姿态——它是唯一"斜着"的，一眼就能从一排植物里认出来。
 * 玉米粒用几排小圆点表示，不画得太细，缩到花园格子那么小时才不会糊成一团。
 */
function KernelPult() {
  return (
    <>
      <Stem x={22} top={40} />
      {/* 底座：一小截托住玉米的斜坡 */}
      <path
        d="M10 52 L34 52 L28 44 L14 44 Z"
        fill="#2f9e2f"
        stroke={OUTLINE}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {/* 玉米棒，向右上方 30 度架着 */}
      <g transform="rotate(-30 32 32)">
        <rect
          x="18"
          y="22"
          width="34"
          height="18"
          rx="9"
          fill="#f2c53d"
          stroke={OUTLINE}
          strokeWidth="3"
        />
        {/* 玉米粒 */}
        {[24, 31, 38, 45].map((cx) =>
          [28, 34].map((cy) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" fill="#d19b1c" />
          ))
        )}
        {/* 尾端的苞叶 */}
        <path
          d="M18 22 L8 18 L10 31 L8 44 L18 40 Z"
          fill="#3fb63f"
          stroke={OUTLINE}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
      <Eye cx={40} cy={20} r={3.4} />
    </>
  );
}

function CherryBomb() {
  return (
    <>
      {/* 两根果柄，在顶上汇到一起，旁边一片叶子 */}
      <path
        d="M22 30 Q28 12 36 8"
        stroke="#6b3d12"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M46 32 Q42 14 36 8"
        stroke="#6b3d12"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse
        cx="47"
        cy="9"
        rx="9"
        ry="5"
        fill="#22b833"
        stroke={OUTLINE}
        strokeWidth="2.6"
        transform="rotate(-18 47 9)"
      />

      {/* 右边那颗画在后面、小一点深一点，做出前后层次；两颗各有一张完整的脸 */}
      <circle cx="45" cy="44" r="14" fill="#c00010" stroke={OUTLINE} strokeWidth="3" />
      <Eye cx={44} cy={44} r={3.8} />
      <Eye cx={53} cy={45} r={3.8} />
      <path d="M40 38 L47 40.5" stroke={OUTLINE} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M57 39 L50 41.5" stroke={OUTLINE} strokeWidth="2.6" strokeLinecap="round" />

      <circle cx="22" cy="42" r="16" fill="#e4000f" stroke={OUTLINE} strokeWidth="3" />
      <ellipse cx="15" cy="33" rx="5" ry="3.2" fill="#ff6a70" transform="rotate(-30 15 33)" />
      <Eye cx={17} cy={42} r={4.4} />
      <Eye cx={28} cy={43} r={4.4} />
      {/* 怒气眉毛——这可是炸弹 */}
      <path d="M11 35 L21 38.5" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
      <path d="M34 36 L24 39.5" stroke={OUTLINE} strokeWidth="3" strokeLinecap="round" />
    </>
  );
}
