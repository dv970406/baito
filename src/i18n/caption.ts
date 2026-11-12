/**
 * 자막 언어 — 일본어가 항상 1순위이고, 그 아래 작은 자막(번역)과 화면 문구가 이 언어로 나온다.
 * 콘텐츠의 영어 필드(en / nameEn / …)는 선택이라 비어 있으면 한국어로 돌아간다.
 */
export type CaptionLang = "ko" | "en";
export const CAPTION_LANGS: readonly CaptionLang[] = ["ko", "en"];

export function isCaptionLang(value: unknown): value is CaptionLang {
  return value === "ko" || value === "en";
}

/** { ko, en? } 꼴에서 자막 언어에 맞는 쪽. en 이 비면 ko */
export function cap(text: { ko: string; en?: string }, lang: CaptionLang): string {
  return lang === "en" && text.en ? text.en : text.ko;
}

/** 필드 이름이 다른 쌍(nameKo/nameEn 등)용 */
export function capPair(ko: string, en: string | undefined, lang: CaptionLang): string {
  return lang === "en" && en ? en : ko;
}
