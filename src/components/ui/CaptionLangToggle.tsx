"use client";

/**
 * 자막 언어 세그먼트 토글 「자막 KO · EN」.
 * 일본어 본문은 그대로, 그 아래 작은 자막과 화면 문구만 바뀐다.
 * 칩과 같은 톤(선택 = 잉크 배경, 비선택 = 흐린 글자) · 보이는 높이 32px + 보이지 않는 터치 영역으로 44px.
 * 복원(hydrated) 전엔 ko 가 눌린 상태로 그리고 누를 수 없다(SSR 과 같은 모양).
 */
import { CAPTION_LANGS, type CaptionLang } from "@/i18n/caption";
import { useT } from "@/i18n/useT";
import { cn } from "@/lib/cn";
import { useGameStore } from "@/store/gameStore";

export interface CaptionLangToggleProps {
  /** surface = 밝은 화면(홈·일시정지) · shell = 어두운 이력서 화면 */
  tone?: "surface" | "shell";
  className?: string;
}

const LABEL: Record<CaptionLang, string> = { ko: "KO", en: "EN" };

export function CaptionLangToggle({ tone = "surface", className }: CaptionLangToggleProps) {
  const { t, lang } = useT();
  const hydrated = useGameStore((s) => s.hydrated);
  const setCaptionLang = useGameStore((s) => s.setCaptionLang);
  const shell = tone === "shell";

  return (
    <div
      role="group"
      aria-label={t("lang.group")}
      data-testid="caption-lang-toggle"
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span aria-hidden="true" className={cn("text-label", shell ? "text-shell-muted" : "text-ink-muted")}>
        {t("lang.label")}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-pill p-0.5",
          shell ? "bg-shell-raised" : "border-[1.5px] border-border bg-surface-raised",
        )}
      >
        {CAPTION_LANGS.map((option) => {
          const selected = option === lang;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              aria-label={t(option === "ko" ? "lang.koAria" : "lang.enAria")}
              disabled={!hydrated}
              onClick={() => setCaptionLang(option)}
              className={cn(
                "relative inline-flex h-7 min-h-0 items-center justify-center rounded-pill px-2.5 font-num text-label font-extrabold tracking-normal",
                "after:absolute after:-inset-x-0.5 after:-inset-y-2 after:content-['']",
                "focus-visible:shadow-focus disabled:cursor-default",
                selected
                  ? shell
                    ? "bg-brand text-brand-ink"
                    : "bg-shell text-shell-ink"
                  : shell
                    ? "text-shell-muted"
                    : "text-ink-muted",
              )}
            >
              {LABEL[option]}
            </button>
          );
        })}
      </span>
    </div>
  );
}
