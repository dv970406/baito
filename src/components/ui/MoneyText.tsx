import type { HTMLAttributes } from "react";
import { formatYen, formatYenDelta } from "@/lib/format";
import { cn } from "@/lib/cn";

export type MoneySize = "money" | "money-lg" | "money-xl";

export interface MoneyTextProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  yen: number;
  size?: MoneySize;
  /** true 면 증감으로 표시: +¥40(perfect-ink) / −¥25(irritation-ink) */
  delta?: boolean;
}

const SIZE_CLASS: Record<MoneySize, string> = {
  money: "text-money",
  "money-lg": "text-money-lg",
  "money-xl": "text-money-xl",
};

/**
 * 엔 금액 텍스트 `¥1,170`. 숫자 서체(font-num)와 money 타입 스케일 세 단계.
 * `delta` 면 부호와 상태색(+ perfect-ink / − irritation-ink / 0 ink-muted)을 붙인다.
 */
export function MoneyText({ yen, size = "money", delta = false, className, ...rest }: MoneyTextProps) {
  const text = delta ? formatYenDelta(yen) : formatYen(yen);
  const toneClass = delta ? (yen > 0 ? "text-perfect-ink" : yen < 0 ? "text-irritation-ink" : "text-ink-muted") : undefined;
  return (
    <span {...rest} className={cn("font-num tabular-nums", SIZE_CLASS[size], toneClass, className)}>
      {text}
    </span>
  );
}
