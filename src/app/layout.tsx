import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c, Noto_Sans_KR } from "next/font/google";
import { SaveSync } from "@/store/SaveSync";
import "./globals.css";

/** 일본어·숫자·UI 기본 서체 (둥근 고딕, POS 느낌) */
const mplus = M_PLUS_Rounded_1c({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-mplus",
  display: "swap",
});

/** 한국어 부제·보조 텍스트 서체 */
const notoKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-noto-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BAITO — 일본 알바 시뮬",
  description:
    "일본에서 알바를 하며 손님을 응대하는 리듬 시뮬레이션. 첫 직장은 편의점 KONBINI.",
  applicationName: "BAITO",
  appleWebApp: { capable: true, title: "BAITO", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F6F2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      data-theme="hiru"
      className={`${mplus.variable} ${notoKr.variable} h-full`}
    >
      <body className="min-h-full">
        <SaveSync>{children}</SaveSync>
      </body>
    </html>
  );
}
