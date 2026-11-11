import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type ProgressTone = "accent" | "brand" | "perfect";

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  tone?: ProgressTone;
  /** 스크린리더 라벨 (예: "시프트 진행") */
  label: string;
  className?: string;
}

const TONE_CLASS: Record<ProgressTone, string> = {
  accent: "bg-accent",
  brand: "bg-brand",
  perfect: "bg-perfect",
};

/**
 * 6px 진행 바. 트랙 border, 채움은 accent(기본)/brand/perfect.
 * 채움 폭은 CSS 변수 `--progress` 로 넘긴다(인라인 레이아웃 스타일 대신).
 */
export function ProgressBar({ value, tone = "accent", label, className }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const pct = Math.round(clamped * 1000) / 10;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-1.5 w-full overflow-hidden rounded-pill bg-border", className)}
      style={{ "--progress": `${pct}%` } as CSSProperties}
    >
      <div
        className={cn(
          "h-full w-(--progress) rounded-pill transition-[width] duration-300 ease-out motion-reduce:transition-none",
          TONE_CLASS[tone],
        )}
      />
    </div>
  );
}
