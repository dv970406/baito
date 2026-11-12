/**
 * 앱 아이콘 도형(satori 호환 JSX). icon.tsx / apple-icon.tsx 가 공유한다.
 * 디자인: 흰 바탕(또는 maskable 이면 블루 바탕 꽉 채움) + 편의점 블루 네모 배지 + 영수증 종이(지그재그 아랫단).
 * 색은 theme.css 토큰 값(blue-500 / neon-50 / ink-900 / neon-500)을 그대로 쓴다.
 */
const BLUE = "#2a6df4";
const PAPER = "#f4f6f2";
const INK = "#1a1d23";
const MUTED = "#8a9099";
const WHITE = "#ffffff";

export const ICON_SIZES = [
  { id: "192", px: 192, maskable: false },
  { id: "512", px: 512, maskable: false },
  { id: "maskable", px: 512, maskable: true },
] as const;

export function BaitoIconArt({ px, maskable }: { px: number; maskable: boolean }) {
  // 모든 치수는 512 기준 비율
  const u = px / 512;
  const badge = maskable ? 512 : 320;
  const badgeRadius = maskable ? 0 : 72;
  const paperW = 160;
  const paperH = 168;
  const tooth = 16;
  const teeth = Math.floor(paperW / tooth);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: maskable ? BLUE : WHITE,
        borderRadius: maskable ? 0 : 112 * u,
      }}
    >
      <div
        style={{
          width: badge * u,
          height: badge * u,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BLUE,
          borderRadius: badgeRadius * u,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: paperW * u, position: "relative" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: paperW * u,
              height: (paperH - tooth / 2) * u,
              background: PAPER,
              padding: `${32 * u}px ${24 * u}px 0`,
              gap: 14 * u,
            }}
          >
            <div style={{ width: 112 * u, height: 12 * u, borderRadius: 6 * u, background: INK }} />
            <div style={{ width: 80 * u, height: 10 * u, borderRadius: 5 * u, background: MUTED }} />
            <div style={{ width: 96 * u, height: 10 * u, borderRadius: 5 * u, background: MUTED }} />
            <div style={{ width: 112 * u, height: 14 * u, borderRadius: 7 * u, background: BLUE, marginTop: 6 * u }} />
          </div>
          {/* 지그재그 아랫단 — 45° 돌린 정사각형 톱니 */}
          <div style={{ display: "flex", width: paperW * u, height: (tooth / 2) * u, overflow: "hidden" }}>
            {Array.from({ length: teeth }, (_, i) => (
              <div
                key={i}
                style={{
                  width: tooth * u,
                  height: tooth * u,
                  marginTop: -(tooth / 2) * u,
                  background: PAPER,
                  transform: "rotate(45deg)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
