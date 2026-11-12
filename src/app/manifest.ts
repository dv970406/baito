import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트 (/manifest.webmanifest).
 * 색은 theme.css 의 昼 surface(#f4f6f2) 토큰과 같다. 아이콘은 SVG(public/icons) + 빌드 시 생성되는 PNG(app/icon.tsx → /icon/<id>).
 * 요청 시점 API 를 쓰지 않으므로 Cache Components 에서도 빌드 시 정적으로 생성된다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BAITO — 일본 알바 리듬 시뮬",
    short_name: "BAITO",
    description: "일본에서 알바를 하며 손님을 응대하는 리듬 시뮬레이션. 첫 직장은 편의점 KONBINI.",
    id: "/",
    start_url: "/konbini",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ko",
    background_color: "#f4f6f2",
    theme_color: "#f4f6f2",
    categories: ["games", "education"],
    icons: [
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
