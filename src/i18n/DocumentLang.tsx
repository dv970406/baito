"use client";

import { useDocumentLang } from "./useT";

/** 루트 레이아웃에 한 번 둔다 — 자막 언어가 바뀌면 document.documentElement.lang 을 바꾼다 */
export function DocumentLang() {
  useDocumentLang();
  return null;
}
