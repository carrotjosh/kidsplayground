import type { MetadataRoute } from "next";

/**
 * PWA 清单。放在 src/app/manifest.ts 是 Next.js 的文件约定，会自动生成
 * /manifest.webmanifest 并在页面里插入 <link rel="manifest">，不用手写标签。
 *
 * 有了它，手机"添加到主屏幕"之后是一个独立的桌面图标：点开全屏、没有浏览器地址栏，
 * 观感和小程序基本一样，但不需要备案、不需要重写任何代码。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "打卡小星星",
    short_name: "打卡",
    description: "家庭学习打卡阳光系统",
    lang: "zh-CN",

    // start_url 用根路径而不是写死 /admin 或 /kid：首页本来就按角色分流
    // （家长 → /admin，孩子设备 → 自己的 /kid/<slug>），所以同一个清单
    // 装在家长手机和孩子平板上，各自打开的是对的页面。
    start_url: "/",
    scope: "/",
    display: "standalone",

    // 和 globals.css 里的 NES 色板保持一致：天蓝做主题色（安卓的状态栏会跟着变），
    // 启动占位背景也用天蓝，避免打开瞬间闪一下白屏。
    theme_color: "#5c94fc",
    background_color: "#5c94fc",

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable 是给安卓自适应图标用的：系统会把图标裁成圆形/squircle，
      // 只保证内圈 80% 不被裁掉，所以这一版把太阳缩小居中、四周留了天蓝安全边。
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
