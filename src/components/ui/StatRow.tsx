import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatTone = "default" | "irritation" | "perfect";

export interface StatRowProps {
  label: ReactNode;
  value: ReactNode;
  /** 값 색. irritation = 놓친 손님, perfect = +¥ 보너스 */
  tone?: StatTone;
  /** lg = 라벨 700 + 큰 값 (오늘 시급 줄) */
  size?: "md" | "lg";
  className?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: "text-ink",
  irritation: "text-irritation-ink",
  perfect: "text-perfect-ink",
};

/**
 * 영수증 한 줄: 왼쪽 라벨, 오른쪽 굵은 값.
 */
export function StatRow({ label, value, tone = "default", size = "md", className }: StatRowProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 font-jp text-body text-ink", className)}>
      <span className={cn(size === "lg" && "font-bold")}>{label}</span>
      <span className={cn("font-bold tabular-nums", TONE_CLASS[tone])}>{value}</span>
    </div>
  );
}

export interface DashedDividerProps {
  className?: string;
}

/**
 * 영수증 구분선 — 2px 점선(border 색).
 */
export function DashedDivider({ className }: DashedDividerProps) {
  return <hr aria-hidden="true" className={cn("m-0 border-0 border-t-2 border-dashed border-border", className)} />;
}
