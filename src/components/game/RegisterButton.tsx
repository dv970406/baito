"use client";

/**
 * 계산대 선택지 버튼 — ui/PosButton 의 인게임 확장판.
 * PosButton 과 같은 네 상태(idle/correct/wrong/dimmed)·64px·2px 테두리를 유지하면서
 * - phrase: 후리가나(reading) 줄 + 일본어 문구 + 한국어 뜻. masked 면 점선 테두리 + 작은 「〇」 표식, 후리가나 숨김
 * - icon:   리스닝 전용 — 아이콘 + 아래 작은 일본어 라벨 (문장 대신 "손님이 말한 것"을 고른다)
 * - shelf:  담배 선반 — 번호를 크게(font-num), 「番」은 작게
 * 세 변형 모두 data-state · data-phrase-id 를 가져 테스트와 보드가 같은 방식으로 찾는다.
 */
import type { ButtonHTMLAttributes } from "react";
import type { PosButtonState } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui";
import { cn } from "@/lib/cn";

export type RegisterButtonVariant = "phrase" | "icon" | "shelf";

export interface RegisterButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** 선택지 id (data-phrase-id) */
  phraseId: string;
  /** 화면에 보일 일본어 — masked 면 호출자가 이미 〇 처리한 텍스트를 넘긴다 */
  ja: string;
  /** 히라가나 읽기 — showKana 이고 masked 가 아닐 때만 보인다 */
  reading?: string;
  ko?: string;
  showKo?: boolean;
  showKana?: boolean;
  /** 가려진 선택지(한자 → 〇) */
  masked?: boolean;
  /** icon 변형의 아이콘 이름 */
  icon?: string;
  variant?: RegisterButtonVariant;
  state?: PosButtonState;
}

const STATE_CLASS: Record<PosButtonState, string> = {
  idle: "border-border bg-surface-raised",
  correct: "border-perfect bg-perfect-soft",
  wrong: "border-irritation bg-irritation-soft",
  dimmed: "border-border bg-surface-raised opacity-60",
};

const ICON_NAMES: readonly IconName[] = ["warm", "bag", "chopsticks", "spoon", "straw", "cup", "snowflake"];
function asIconName(name: string | undefined): IconName {
  return name && (ICON_NAMES as readonly string[]).includes(name) ? (name as IconName) : "bag";
}

/** "23番" → ["23", "番"] (숫자 부분과 나머지) */
function splitShelfLabel(ja: string): [string, string] {
  const m = /^(\d+)(.*)$/.exec(ja);
  return m ? [m[1], m[2]] : [ja, ""];
}

export function RegisterButton({
  phraseId,
  ja,
  reading,
  ko,
  showKo = false,
  showKana = false,
  masked = false,
  icon,
  variant = "phrase",
  state = "idle",
  className,
  type,
  disabled,
  ...rest
}: RegisterButtonProps) {
  const base = cn(
    "relative flex min-h-pos-button w-full rounded-xl border-2 text-ink",
    "transition-transform duration-[80ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
    "focus-visible:border-brand focus-visible:shadow-focus disabled:cursor-default disabled:active:scale-100",
    STATE_CLASS[state],
    className,
  );

  if (variant === "icon") {
    return (
      <button
        type={type ?? "button"}
        data-state={state}
        data-phrase-id={phraseId}
        data-variant="icon"
        disabled={disabled}
        {...rest}
        className={cn(base, "flex-col items-center justify-center gap-1 px-2 py-2")}
      >
        <Icon name={asIconName(icon)} size={26} className="text-ink" />
        <span lang="ja" className="block font-jp text-caption font-bold leading-4">
          {ja}
        </span>
        {showKo && ko ? <span className="block font-ko text-micro text-ink-muted">{ko}</span> : null}
      </button>
    );
  }

  if (variant === "shelf") {
    const [num, unit] = splitShelfLabel(ja);
    return (
      <button
        type={type ?? "button"}
        data-state={state}
        data-phrase-id={phraseId}
        data-variant="shelf"
        disabled={disabled}
        {...rest}
        className={cn(base, "items-baseline justify-center gap-1 px-3 py-2")}
      >
        <span className="font-num text-money-lg tabular-nums">{num}</span>
        {unit ? (
          <span lang="ja" className="font-jp text-caption font-bold text-ink-muted">
            {unit}
          </span>
        ) : null}
      </button>
    );
  }

  // 한자가 없어 읽기가 본문과 같으면 후리가나 줄은 중복이라 숨긴다
  const showReading = showKana && !masked && Boolean(reading) && reading !== ja;
  return (
    <button
      type={type ?? "button"}
      data-state={state}
      data-phrase-id={phraseId}
      data-variant="phrase"
      data-masked={masked ? "true" : undefined}
      disabled={disabled}
      {...rest}
      className={cn(
        base,
        "flex-col items-start justify-center px-3 text-left font-jp text-pos-option",
        showReading ? "gap-0 py-1.5" : "gap-0.5 py-2.5",
        masked && "border-dashed",
      )}
    >
      {masked ? (
        <span aria-hidden="true" className="absolute right-2 top-1.5 font-jp text-micro leading-none text-ink-muted">
          〇
        </span>
      ) : null}
      {showReading ? (
        <span lang="ja" className="block font-jp text-micro leading-[14px] text-ink-muted" data-reading>
          {reading}
        </span>
      ) : null}
      <span lang="ja" className="block">
        {ja}
      </span>
      {showKo && ko ? <span className="block font-ko text-caption text-ink-muted">{ko}</span> : null}
    </button>
  );
}
