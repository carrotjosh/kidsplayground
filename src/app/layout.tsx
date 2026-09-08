import type { Metadata } from "next";
import { Press_Start_2P, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

// 像素字体只覆盖英文/数字，专门用在积分数字这类场景。
const pixelFont = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

// 圆润活泼的中文字体，撑起整体的游戏感，中文字符也能显示。
const playfulFont = ZCOOL_KuaiLe({
  variable: "--font-playful",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "打卡小星星",
  description: "家庭学习打卡阳光系统",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning：浏览器翻译类插件（如 Trancy）会往 <html> 上注入自己的属性，
    // 导致服务端渲染结果和客户端对不上、开发模式下报 hydration 警告。这个属性只影响这一层元素，
    // 不会掩盖子组件里真正的 hydration 问题。
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${pixelFont.variable} ${playfulFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
