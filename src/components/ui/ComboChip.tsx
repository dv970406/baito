"use client";

import { useEffect, useRef } from "react";
import { useT } from "@/i18n/useT";
import { Icon } from "./Icon";
import { cn } from "@/lib/cn";

export interface ComboChipProps {
  /** 현재 콤보 수 */
  n: number;
  className?: string;
}

/**
 * 콤보 칩 `×N`. combo-soft 배경 + combo 글자 + 번개 아이콘.
 * n 이 커질 때마다 살짝 튀는 펄스(Web Animations API, 모션 축소 설정이면 생략).
 */
export function ComboChip({ n, className }: ComboChipProps) {
  const { t } = useT();
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(n);

  useEffect(() => {
    const el = ref.current;
    const increased = n > prev.current;
    prev.current = n;
    if (!increased || !el || typeof el.animate !== "function") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.18)", offset: 0.4 }, { transform: "scale(1)" }],
      { duration: 260, easing: "ease-out" },
    );
    return () => anim.cancel();
  }, [n]);

  return (
    <span
      ref={ref}
      role="status"
      aria-label={t("ui.combo", { n })}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-combo-soft px-2.5 py-1.5 font-num text-[13px] font-extrabold leading-none text-combo",
        className,
      )}
    >
      <Icon name="bolt" size={14} strokeWidth={2.5} />
      <span aria-hidden="true">×{n}</span>
    </span>
  );
}
