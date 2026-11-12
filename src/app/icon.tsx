import { ImageResponse } from "next/og";
import { BaitoIconArt, ICON_SIZES } from "./iconArt";

/**
 * 앱 아이콘 PNG — 빌드 시 ImageResponse(next/og)로 생성된다 (/icon/192, /icon/512, /icon/maskable).
 * 요청 시점 API 를 쓰지 않아 정적으로 굳고, 「バ」는 폰트 없이 SVG 획으로 그린다(satori 기본 폰트에 일본어 글리프가 없다).
 */
export function generateImageMetadata() {
  return ICON_SIZES.map((icon) => ({
    id: icon.id,
    size: { width: icon.px, height: icon.px },
    contentType: "image/png",
    alt: "BAITO",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const key = String(await id);
  const icon = ICON_SIZES.find((i) => i.id === key) ?? ICON_SIZES[0];
  return new ImageResponse(<BaitoIconArt px={icon.px} maskable={icon.maskable} />, {
    width: icon.px,
    height: icon.px,
  });
}
