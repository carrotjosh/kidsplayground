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
  description: "家庭学习打卡积分系统",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${pixelFont.variable} ${playfulFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
