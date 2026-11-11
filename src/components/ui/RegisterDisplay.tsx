import { formatYen } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface RegisterDisplayProps {
  /** 금액(¥) */
  yen: number;
  /** 앞 라벨 (기본 合計) */
  label?: string;
  className?: string;
}

/**
 * 레지 디스플레이 `合計 ¥598`. 잉크 배경 위 형광 녹색 숫자(register-glow), 등폭 숫자 서체.
 */
export function RegisterDisplay({ yen, label = "合計", className }: RegisterDisplayProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-sm bg-shell px-2.5 py-1 font-num text-register tabular-nums text-register-glow",
        className,
      )}
    >
      {label ? <span>{label}</span> : null}
      <span>{formatYen(yen)}</span>
    </span>
  );
}
