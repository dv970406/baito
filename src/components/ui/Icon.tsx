import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/** 사용 가능한 아이콘 이름 (Lucide 계열 2px 스트로크) */
export type IconName =
  | "calendar"
  | "book"
  | "receipt"
  | "trophy"
  | "lock"
  | "check"
  | "bolt"
  | "mic"
  | "share"
  | "chevronDown"
  | "chevronRight"
  | "close"
  | "store"
  | "hotel"
  | "restaurant"
  | "plane"
  | "cup"
  | "snowflake"
  | "card"
  | "coin"
  | "qr"
  | "phone"
  | "clock"
  | "refresh"
  | "play";

export type IconSize = 14 | 16 | 18 | 20 | 22 | 26 | 30 | 32;

/** 24 viewBox 기준 path 데이터. 각 항목은 <path d> 또는 완성된 요소 배열 */
const ICON_PATHS: Record<IconName, React.ReactNode> = {
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />,
  receipt: (
    <>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  trophy: <path d="M8 21h8M12 17v4M6 3h12v6a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </>
  ),
  share: <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6" />,
  hotel: <path d="M3 21V7l9-4 9 4v14M3 21h18M9 21v-5h6v5M8 11h2M14 11h2M8 15h2M14 15h2" />,
  restaurant: <path d="M3 11h18a9 9 0 0 1-18 0zM3 11c0-3 4-6 9-6s9 3 9 6M12 5V3M8 21h8" />,
  plane: <path d="M2 16l20-6-2-2-6 2-7-6-3 1 4 6-5 2-2-1-1 1z" />,
  cup: (
    <>
      <path d="M17 9h1a3.5 3.5 0 1 1 0 7h-1M3 9h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
      <path d="M7 2v3M11 2v3M15 2v3" />
    </>
  ),
  snowflake: <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />,
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8l3 4.5L15 8M12 12.5V17M9.5 14.5h5" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 21v-1" />
    </>
  ),
  phone: (
    <>
      <rect x="4" y="2" width="12" height="20" rx="2" />
      <path d="M8 18h4M19 9a4.5 4.5 0 0 1 0 6M21.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  refresh: <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
  play: <path d="M6 4l14 8-14 8z" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height"> {
  name: IconName;
  /** 픽셀 크기. 탭바 22 · 인라인 16 · 직장 카드 30 */
  size?: IconSize;
  /** 스트로크 두께 (기본 2) */
  strokeWidth?: number;
  /** 지정하면 role="img" + aria-label, 없으면 장식(aria-hidden) */
  label?: string;
}

/**
 * 인라인 스트로크 SVG 아이콘. currentColor 를 따르므로 부모의 text-* 색을 그대로 받는다.
 * - `label` 이 없으면 장식용으로 간주해 스크린리더에서 숨긴다.
 */
export function Icon({ name, size = 22, strokeWidth = 2, label, className, ...rest }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <svg
      {...a11y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      data-icon={name}
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
