/**
 * 앱 아이콘 도형(satori 호환 JSX). icon.tsx / apple-icon.tsx 가 공유한다.
 * 디자인: 흰 바탕(또는 maskable 이면 블루 바탕 꽉 채움) + 편의점 블루 네모 배지 + 흰 「バ」(KanjiBadge 와 같은 문법).
 * 「バ」는 폰트 없이 둥근 획 SVG 경로로 그린다 — satori 기본 폰트에 일본어 글리프가 없고, 폰트 번들은 아이콘 하나에 과하다.
 * 색은 theme.css 토큰 값(blue-500 / white)을 그대로 쓴다.
 */
const BLUE = "#2a6df4";
const WHITE = "#ffffff";

export const ICON_SIZES = [
  { id: "192", px: 192, maskable: false },
  { id: "512", px: 512, maskable: false },
  { id: "maskable", px: 512, maskable: true },
] as const;

/** 512 기준 「バ」 획 — ハ 두 획 + 탁점 두 개. public/icons/icon.svg 와 같은 좌표 */
export const BA_STROKES = {
  main: ["M226 204 C214 268 188 318 146 358", "M284 206 C310 264 338 312 374 354"],
  dakuten: ["M330 132 L346 172", "M372 120 L388 160"],
} as const;

export function BaitoIconArt({ px, maskable }: { px: number; maskable: boolean }) {
  // maskable 은 안전 영역(가운데 80%) 안에 글자가 들어가도록 배지 대신 바탕 전체를 블루로 채운다
  const badge = maskable ? 512 : 320;
  const badgeOffset = (512 - badge) / 2;
  const badgeRadius = maskable ? 0 : 72;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: maskable ? BLUE : WHITE,
        borderRadius: maskable ? 0 : (112 * px) / 512,
      }}
    >
      <svg width={px} height={px} viewBox="0 0 512 512">
        <rect x={badgeOffset} y={badgeOffset} width={badge} height={badge} rx={badgeRadius} fill={BLUE} />
        {BA_STROKES.main.map((d) => (
          <path key={d} d={d} fill="none" stroke={WHITE} strokeWidth={40} strokeLinecap="round" />
        ))}
        {BA_STROKES.dakuten.map((d) => (
          <path key={d} d={d} fill="none" stroke={WHITE} strokeWidth={26} strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}
