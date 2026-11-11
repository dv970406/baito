"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type PosButtonState = "idle" | "correct" | "wrong" | "dimmed";

export interface PosButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** 일본어 접객 문구 (주) */
  ja: string;
  /** 한국어 번역 (부제). showKo 가 true 일 때만 보인다 */
  ko?: string;
  showKo?: boolean;
  /** idle 기본 · correct 정답 · wrong 오답 · dimmed 선택 안 된 나머지 */
  state?: PosButtonState;
}

const STATE_CLASS: Record<PosButtonState, string> = {
  idle: "border-border bg-surface-raised",
  correct: "border-perfect bg-perfect-soft",
  wrong: "border-irritation bg-irritation-soft",
  dimmed: "border-border bg-surface-raised opacity-60",
};

/**
 * POS 선택지 버튼. 퀴즈 카드가 아니라 계산대 버튼처럼: 왼쪽 정렬, 64px, 2px 테두리.
 * 네 상태(idle/correct/wrong/dimmed) 는 테두리·배경만 바뀌고, 누르면 80ms 동안 0.98 배로 눌린다
 * (prefers-reduced-motion 이면 생략).
 */
export function PosButton({ ja, ko, showKo = false, state = "idle", className, type, disabled, ...rest }: PosButtonProps) {
  return (
    <button
      type={type ?? "button"}
      data-state={state}
      disabled={disabled}
      {...rest}
      className={cn(
        "flex min-h-pos-button w-full flex-col items-start justify-center gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left font-jp text-pos-option text-ink",
        "transition-transform duration-[80ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus-visible:border-brand focus-visible:shadow-focus disabled:cursor-default disabled:active:scale-100",
        STATE_CLASS[state],
        className,
      )}
    >
      <span className="block">{ja}</span>
      {showKo && ko ? <span className="block font-ko text-caption text-ink-muted">{ko}</span> : null}
    </button>
  );
}
