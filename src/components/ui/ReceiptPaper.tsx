import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ReceiptPaperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * 영수증 종이. 흰 배경, 패딩 22/20/26, 아래 가장자리는 8px 지그재그(clip-path 다각형).
 * 앱에서 유일하게 블러 그림자(shadow-receipt)를 쓰는 요소.
 */
export function ReceiptPaper({ className, children, ...rest }: ReceiptPaperProps) {
  return (
    <div
      {...rest}
      className={cn(
        "relative flex flex-col bg-surface-raised px-5 pb-[26px] pt-[22px] text-ink shadow-receipt",
        "[clip-path:polygon(0_0,100%_0,100%_calc(100%_-_8px),97%_100%,94%_calc(100%_-_8px),91%_100%,88%_calc(100%_-_8px),85%_100%,82%_calc(100%_-_8px),79%_100%,76%_calc(100%_-_8px),73%_100%,70%_calc(100%_-_8px),67%_100%,64%_calc(100%_-_8px),61%_100%,58%_calc(100%_-_8px),55%_100%,52%_calc(100%_-_8px),49%_100%,46%_calc(100%_-_8px),43%_100%,40%_calc(100%_-_8px),37%_100%,34%_calc(100%_-_8px),31%_100%,28%_calc(100%_-_8px),25%_100%,22%_calc(100%_-_8px),19%_100%,16%_calc(100%_-_8px),13%_100%,10%_calc(100%_-_8px),7%_100%,4%_calc(100%_-_8px),1%_100%,0_calc(100%_-_8px))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 디자인의 막대 폭 패턴(px) — 장식용 바코드 */
const BAR_WIDTHS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2] as const;
const BAR_WIDTH_CLASS: Record<(typeof BAR_WIDTHS)[number], string> = {
  1: "w-px",
  2: "w-0.5",
  3: "w-[3px]",
};

export interface BarcodeProps {
  className?: string;
}

/**
 * 영수증 아래 장식 바코드(28px). 의미 없는 장식이라 aria-hidden.
 */
export function Barcode({ className }: BarcodeProps) {
  return (
    <div aria-hidden="true" className={cn("flex h-7 items-stretch justify-center gap-0.5", className)}>
      {BAR_WIDTHS.map((w, i) => (
        <span key={i} className={cn("bg-shell", BAR_WIDTH_CLASS[w])} />
      ))}
    </div>
  );
}
