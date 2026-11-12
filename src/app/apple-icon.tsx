import { ImageResponse } from "next/og";
import { BaitoIconArt } from "./iconArt";

/** iOS 홈 화면 아이콘(180×180). iOS 가 모서리를 깎으므로 바탕을 꽉 채운 maskable 변형을 쓴다 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BaitoIconArt px={size.width} maskable />, size);
}
