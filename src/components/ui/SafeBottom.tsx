import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SafeBottomProps extends HTMLAttributes<HTMLDivElement> {
  /** 좌우 인셋. screen=20(직장 화면) · shell=24(이력서) */
  inset?: "screen" | "shell";
  children: ReactNode;
}

/**
 * 화면 하단 CTA 묶음 래퍼. 아래 pb-safe-cta(36) 를 확보하고 자식을 10px 간격 세로로 쌓는다.
 * Screen 의 footer 자리나 본문 마지막에 둔다(mt-auto 로 바닥에 붙음).
 */
export function SafeBottom({ inset = "screen", className, children, ...rest }: SafeBottomProps) {
  return (
    <div
      {...rest}
      className={cn(
        "mt-auto flex flex-col gap-2.5 pb-safe-cta pt-3",
        inset === "shell" ? "px-shell" : "px-screen",
        className,
      )}
    >
      {children}
    </div>
  );
}
