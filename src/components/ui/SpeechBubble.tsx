import { cn } from "@/lib/cn";

export interface SpeechBubbleProps {
  /** 일본어 대사. 비어 있으면 "…" 을 옅게 보여준다 */
  ja: string;
  /** 한국어 부제 */
  ko?: string;
  /** 꼬리 방향 — 말하는 사람이 어느 쪽에 있는지 */
  tail?: "left" | "right";
  className?: string;
}

/**
 * 손님 말풍선. 흰 카드(1px 선), 14/14/14/4 라디우스로 한쪽 아래 모서리가 꼬리가 된다.
 * 일본어가 주(text-bubble), 한국어는 작은 부제. aria-live 로 대사 변화를 읽어준다.
 */
export function SpeechBubble({ ja, ko, tail = "left", className }: SpeechBubbleProps) {
  const empty = ja.trim().length === 0;
  return (
    <div
      aria-live="polite"
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
          <span lang="ja" className="block">
            {ja}
          </span>
          {ko ? <span className="mt-0.5 block font-ko text-caption text-ink-muted">{ko}</span> : null}
        </>
      )}
    </div>
  );
}
