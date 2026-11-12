"use client";

/**
 * 손님 말풍선 — ui/SpeechBubble 과 같은 모양(흰 카드·헤어라인·14/14/14/4 라디우스)에
 * - lang: 관광객의 영어 대사는 lang="en" 으로 읽힌다
 * - drunk: 취객의 대사는 글자가 미세하게 흔들린다 (Web Animations API, prefers-reduced-motion 이면 생략)
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

export interface CustomerBubbleProps {
  ja: string;
  ko?: string;
  /** 대사 언어 (기본 ja) */
  lang?: "ja" | "en";
  drunk?: boolean;
  tail?: "left" | "right";
  className?: string;
}

/** 흔들림 키프레임 — 1~1.5px 범위, 2초 주기로 반복 */
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: "translate(0, 0) rotate(0deg)" },
  { transform: "translate(1px, -1px) rotate(-0.6deg)", offset: 0.2 },
  { transform: "translate(-1px, 1px) rotate(0.5deg)", offset: 0.45 },
  { transform: "translate(1.5px, 0.5px) rotate(-0.4deg)", offset: 0.7 },
  { transform: "translate(0, 0) rotate(0deg)" },
];

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CustomerBubble({ ja, ko, lang = "ja", drunk = false, tail = "left", className }: CustomerBubbleProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const empty = ja.trim().length === 0;

  useEffect(() => {
    const el = textRef.current;
    if (!drunk || empty || !el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    const anim = el.animate(SHAKE_KEYFRAMES, { duration: 2000, iterations: Infinity, easing: "ease-in-out" });
    return () => anim.cancel();
  }, [drunk, empty, ja]);

  return (
    <div
      aria-live="polite"
      data-drunk={drunk ? "true" : undefined}
      className={cn(
        "max-w-[180px] bg-surface-raised px-3 py-2.5 font-jp text-bubble text-ink shadow-hairline",
        tail === "left" ? "rounded-[14px_14px_14px_4px]" : "rounded-[14px_14px_4px_14px]",
        className,
      )}
    >
      {empty ? (
        <span className="text-ink-muted" aria-label="말 없음">
          …
        </span>
      ) : (
        <>
          <span ref={textRef} lang={lang} className={cn("block", lang === "en" && "font-num")}>
            {ja}
          </span>
          {ko ? <span className="mt-0.5 block font-ko text-caption text-ink-muted">{ko}</span> : null}
        </>
      )}
    </div>
  );
}
