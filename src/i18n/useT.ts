"use client";

/**
 * 화면 문구 훅. `t(key, vars?)` 와 현재 자막 언어 `lang` 을 돌려준다.
 * 세이브 복원(hydrated) 전에는 저장값과 무관하게 항상 ko — 서버 프리렌더(Cache Components)와
 * 첫 클라이언트 렌더가 같은 문구를 그려 hydration 불일치가 나지 않게 한다.
 */
import { useCallback, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import type { CaptionLang } from "./caption";
import { translate, type MessageKey, type MessageVars, type TFunction } from "./messages";

/** 지금 화면에 쓸 자막 언어 (복원 전엔 ko) */
export function useCaptionLang(): CaptionLang {
  const hydrated = useGameStore((s) => s.hydrated);
  const stored = useGameStore((s) => s.captionLang);
  return hydrated ? stored : "ko";
}

export function useT(): { t: TFunction; lang: CaptionLang } {
  const lang = useCaptionLang();
  const t = useCallback((key: MessageKey, vars?: MessageVars) => translate(lang, key, vars), [lang]);
  return { t, lang };
}

/** <html lang> 을 자막 언어에 맞춘다(서버 메타데이터·초기 HTML 은 ko 그대로) */
export function useDocumentLang(): void {
  const lang = useCaptionLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}
