import { cn } from "@/lib/cn";

export interface IrritationGaugeProps {
  /** 채워진 칸 수 */
  value: number;
  /** 전체 칸 수 (기본 4) */
  max?: number;
  className?: string;
}

/**
 * 손님 짜증 게이지. 흰 알약 안에 8px 점 N개 — 채워진 점은 irritation, 빈 점은 border.
 * role="img" + "짜증 게이지 {value}/{max}".
 */
export function IrritationGauge({ value, max = 4, className }: IrritationGaugeProps) {
  const total = Math.max(0, Math.trunc(max));
  const filled = Math.min(total, Math.max(0, Math.trunc(value)));
  return (
    <div
      role="img"
      aria-label={`짜증 게이지 ${filled}/${total}`}
      className={cn("inline-flex items-center gap-[5px] rounded-pill bg-surface-raised px-2.5 py-1.5 shadow-hairline", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          data-filled={i < filled ? "true" : undefined}
          className={cn(
            "size-2 rounded-full transition-colors duration-150 motion-reduce:transition-none",
            i < filled ? "bg-irritation" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}
