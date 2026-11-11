"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** 선택 상태 — aria-pressed 로 노출 */
  selected?: boolean;
  children: ReactNode;
}

/**
 * 필터 칩(36px). 선택 = 잉크 배경 + 흰 글자, 비선택 = 흰 배경 + 1.5px 선 + ink-muted.
 * 시각 높이는 36px 이지만 보이지 않는 터치 영역을 위아래로 4px 씩 넓혀 44px 를 확보한다.
 */
export function Chip({ selected = false, className, children, type, ...rest }: ChipProps) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={selected}
      {...rest}
      className={cn(
        "relative inline-flex min-h-chip items-center justify-center whitespace-nowrap rounded-pill px-3.5 font-jp text-[13px] font-bold leading-none",
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        "focus-visible:shadow-focus disabled:opacity-50",
        selected
          ? "bg-shell text-shell-ink"
          : "border-[1.5px] border-border bg-surface-raised text-ink-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}
