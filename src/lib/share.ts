/**
 * 공유 헬퍼. Web Share API 가 있으면 시스템 공유 시트, 없으면 클립보드 복사.
 * SSR 에서는 항상 "unsupported".
 */
export type ShareResult = "shared" | "copied" | "unsupported" | "cancelled";

export interface ShareTextInput {
  title: string;
  text: string;
  url?: string;
}

export async function shareText({ title, text, url }: ShareTextInput): Promise<ShareResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";

  const payload: ShareData = url ? { title, text, url } : { title, text };

  if (typeof navigator.share === "function") {
    try {
      if (typeof navigator.canShare !== "function" || navigator.canShare(payload)) {
        await navigator.share(payload);
        return "shared";
      }
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우 — 복사로 넘어가지 않는다
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // 그 외 실패는 클립보드로 폴백
    }
  }

  const clipboard = navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(url ? `${text}\n${url}` : text);
      return "copied";
    } catch {
      return "unsupported";
    }
  }
  return "unsupported";
}
