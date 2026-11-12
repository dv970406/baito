/**
 * 공유 헬퍼. 텍스트는 Web Share API → 클립보드 복사, 파일(이미지)은 Web Share API → `<a download>` 저장.
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

/* ───────────────────────── 파일(이미지) 공유 ───────────────────────── */

export type ShareFileResult = "shared" | "downloaded" | "unsupported" | "cancelled";

/**
 * 이미지 파일 공유. Web Share API 가 files 를 지원하면 시스템 공유 시트,
 * 아니면 `<a download>` 로 기기에 저장한다. SSR 에서는 "unsupported".
 */
export async function shareFile(blob: Blob, filename: string, text: string): Promise<ShareFileResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || typeof document === "undefined") {
    return "unsupported";
  }

  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const payload: ShareData = { files: [file], text };

  if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
    try {
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
        return "shared";
      }
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우 — 저장으로 넘어가지 않는다
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // 그 외 실패는 다운로드로 폴백
    }
  }

  return downloadBlob(blob, filename) ? "downloaded" : "unsupported";
}

/** Blob 을 `<a download>` 로 저장한다. URL.createObjectURL 이 없으면 false */
export function downloadBlob(blob: Blob, filename: string): boolean {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 클릭 처리 뒤에 해제 (바로 해제하면 일부 브라우저가 저장을 취소한다)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
