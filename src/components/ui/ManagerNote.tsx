import { KanjiBadge } from "./Badge";
import { cn } from "@/lib/cn";

export interface ManagerNoteProps {
  /** 점장 대사 (일본어, 주) */
  ja: string;
  /** 한국어 번역 (부제) */
  ko?: string;
  /** card = tip-soft 배경 카드(홈) · plain = 배경 없이(영수증 안) */
  variant?: "card" | "plain";
  className?: string;
}

/**
 * 점장(店長) 한마디. 노란 店長 배지 + 일본어 700 14px + 한국어 캡션.
 */
export function ManagerNote({ ja, ko, variant = "card", className }: ManagerNoteProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5",
        variant === "card" && "rounded-xl bg-tip-soft px-3.5 py-3",
        className,
      )}
    >
      <KanjiBadge kanji="店長" tone="tip" label="점장" className="text-[11px]" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span lang="ja" className="font-jp text-bubble text-ink">
          {ja}
        </span>
        {ko ? <span className="font-ko text-caption text-ink-muted">{ko}</span> : null}
      </div>
    </div>
  );
}
