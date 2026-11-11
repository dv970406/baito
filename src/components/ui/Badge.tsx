import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "perfect" | "combo" | "tip" | "accent" | "shell" | "muted";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** sm = 11px 라벨(3/8 패딩) · md = 12px(6/10 패딩) */
  size?: BadgeSize;
  children: ReactNode;
}

const BADGE_TONE: Record<BadgeTone, string> = {
  perfect: "bg-perfect-soft text-perfect-ink",
  combo: "bg-combo-soft text-combo",
  tip: "bg-tip text-ink",
  accent: "bg-accent-soft text-accent",
  shell: "bg-shell text-shell-ink",
  muted: "bg-surface-sunken text-ink-muted",
};

const BADGE_SIZE: Record<BadgeSize, string> = {
  sm: "px-2 py-[3px] text-label font-extrabold tracking-normal",
  md: "px-2.5 py-1.5 text-caption font-bold",
};

/**
 * 알약형 상태 배지 ("근무 중", "아침 단골", "여행팩").
 * 색은 상태 토큰만 쓰고, 텍스트는 11px(sm)/12px(md) 두 크기.
 */
export function Badge({ tone = "muted", size = "sm", className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-pill font-jp leading-none",
        BADGE_TONE[tone],
        BADGE_SIZE[size],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type KanjiBadgeTone = "accent" | "tip" | "perfect" | "sunken" | "ghost";
export type KanjiBadgeSize = "sm" | "lg";

export interface KanjiBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 한자 한두 글자: 朝 / 昼 / 夕 / 店長 */
  kanji: string;
  tone?: KanjiBadgeTone;
  /** sm = 28px rounded-md(기본) · lg = 44px rounded-lg (시프트 카드) */
  size?: KanjiBadgeSize;
  /** 스크린리더용 설명 (예: "아침 시프트"). 없으면 한자 그대로 읽힌다 */
  label?: string;
}

const KANJI_TONE: Record<KanjiBadgeTone, string> = {
  accent: "bg-accent text-brand-ink",
  tip: "bg-tip text-ink",
  perfect: "bg-perfect-soft text-perfect-ink",
  sunken: "bg-surface-sunken text-ink-muted",
  /** accent 카드 위에 올라가는 반투명 배지 */
  ghost: "bg-white/18 text-brand-ink",
};

const KANJI_SIZE: Record<KanjiBadgeSize, string> = {
  sm: "size-7 rounded-md text-caption font-extrabold",
  lg: "size-11 rounded-lg text-[18px] font-extrabold",
};

/**
 * 네모 한자 배지 (시간대 朝/昼/夕, 점장 店長).
 * 28px rounded-md 가 기본, 시프트 카드에서는 44px rounded-lg.
 */
export function KanjiBadge({ kanji, tone = "accent", size = "sm", label, className, ...rest }: KanjiBadgeProps) {
  return (
    <span
      {...rest}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-jp leading-none tracking-normal",
        KANJI_TONE[tone],
        KANJI_SIZE[size],
        className,
      )}
    >
      {kanji}
    </span>
  );
}
