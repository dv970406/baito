"use client";

import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";

export interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  /** 지름(px). 기본 36 */
  size?: number;
  className?: string;
}

const STROKE = 4;

/**
 * 질문 제한 시간 링(36px). 트랙은 border, 남은 시간 호는 irritation.
 * 가운데에 남은 초를 소수 한 자리로 보여준다. 호는 100ms linear 로 부드럽게 줄어든다.
 */
export function TimerRing({ remainingMs, totalMs, size = 36, className }: TimerRingProps) {
  const { t } = useT();
  const r = size / 2 - STROKE / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const ratio = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const offset = circumference * (1 - ratio);
  const seconds = Math.max(0, remainingMs) / 1000;
  const label = seconds.toFixed(1);

  return (
    <div
      role="timer"
      aria-label={t("ui.timeLeft", { s: label })}
      aria-live="off"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-border" strokeWidth={STROKE} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-irritation transition-[stroke-dashoffset] duration-100 ease-linear motion-reduce:transition-none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="relative font-num text-label font-extrabold tracking-normal text-ink">{label}</span>
    </div>
  );
}
