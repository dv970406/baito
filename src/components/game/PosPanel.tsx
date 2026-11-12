"use client";

/**
 * POS 패널 — 레지 라벨 · 合計 디스플레이 · 질문 줄(타이머 링) · 2×2 선택지 · 뜻 토글.
 * 선택지는 퀴즈 카드가 아니라 계산대 버튼이다. 피드백은 "정답/오답" 글자가 아니라 손님 리액션과 속도 등급.
 */
import type { AnswerOption, QuestionKind, ShiftPhase } from "@/engine/types";
import { maskJa } from "@/engine/distractor";
import type { SpeechUiState } from "./ShiftBoard";
import { Chip, Icon, RegisterDisplay, TimerRing, type PosButtonState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RegisterButton, type RegisterButtonVariant } from "./RegisterButton";

export interface PosPanelProps {
  registerLabel: string;
  /** 손님 합계(¥). 손님이 없으면 null → 0 표시 */
  total: number | null;
  phase: ShiftPhase;
  /** 현재 질문 종류 — LISTEN 은 아이콘 그리드, TOBACCO_PICK 은 번호 선반으로 그린다 */
  kind: QuestionKind | null;
  options: AnswerOption[];
  /** 이번 질문에서 플레이어가 누른 선택지 */
  pressedId: string | null;
  /** 현재 질문에서 틀린 횟수 — 1 이상이면 "같은 질문을 한 번 더" */
  wrongOnStep: number;
  /** 질문 N/M (손님 한 명의 질문 큐) */
  stepIndex: number;
  stepCount: number;
  questionRemainingMs: number;
  questionTotalMs: number;
  showKo: boolean;
  onToggleKo: () => void;
  /** 후리가나(かな) 표시 */
  showKana: boolean;
  onToggleKana: () => void;
  onAnswer: (phraseId: string) => void;
  /** 말하기 버튼 상태: hidden(미지원) · locked(해금 전) · ready · listening */
  speech?: SpeechUiState;
  /** 듣는 중 중간 인식 텍스트 */
  interim?: string;
  /** 인식 실패 안내(벌점 없음) */
  speechNote?: string | null;
  onSpeak?: () => void;
  className?: string;
}

function optionState(option: AnswerOption, pressedId: string | null, phase: ShiftPhase): PosButtonState {
  if (phase === "question") return "idle";
  // 시간 초과(누른 것 없음)면 전부 흐리게, 눌렀으면 그 버튼만 결과색 — 나머지 정답은 드러내지 않는다(재시도가 있기 때문)
  if (pressedId === null || option.phraseId !== pressedId) return "dimmed";
  return option.isCorrect ? "correct" : "wrong";
}

/** 질문 종류 → 버튼 변형 */
function variantFor(kind: QuestionKind | null): RegisterButtonVariant {
  if (kind === "LISTEN") return "icon";
  if (kind === "TOBACCO_PICK") return "shelf";
  return "phrase";
}

/** 질문 줄 안내 — 리스닝은 "들은 것", 담배는 "선반 번호", 나머지는 "할 말" */
function promptFor(kind: QuestionKind | null, retry: boolean): string {
  if (retry) return "같은 질문을 한 번 더";
  if (kind === "LISTEN") return "손님이 말한 건?";
  if (kind === "TOBACCO_PICK") return "선반에서 꺼낼 번호는?";
  return "손님에게 할 말은?";
}

export function PosPanel({
  registerLabel,
  total,
  phase,
  kind,
  options,
  pressedId,
  wrongOnStep,
  stepIndex,
  stepCount,
  questionRemainingMs,
  questionTotalMs,
  showKo,
  onToggleKo,
  showKana,
  onToggleKana,
  onAnswer,
  speech = "locked",
  interim = "",
  speechNote = null,
  onSpeak,
  className,
}: PosPanelProps) {
  const answering = phase === "question";
  const prompt = promptFor(kind, wrongOnStep > 0 && answering);
  const variant = variantFor(kind);
  // 선택지가 아직 없을 때(enter)도 자리는 유지해 레이아웃이 튀지 않게 한다
  const slots: (AnswerOption | null)[] = options.length > 0 ? options : [null, null, null, null];

  return (
    <section
      aria-label="계산대"
      className={cn(
        "flex flex-1 flex-col gap-3 rounded-t-panel bg-surface-raised px-4 pb-5 pt-4 shadow-panel-up",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-2 rounded-full bg-perfect" />
          <span className="font-jp text-label text-ink-muted">{registerLabel}</span>
        </div>
        <RegisterDisplay yen={total ?? 0} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="font-ko text-[15px] font-bold leading-5 text-ink">{prompt}</span>
          {stepCount > 0 ? (
            <span className="font-num text-label text-ink-muted">
              {Math.min(stepIndex + 1, stepCount)}/{stepCount}
            </span>
          ) : null}
        </div>
        {/* 질문 중이 아닐 때는 가득 찬 링(대기) — 0.0 으로 보여 "시간 초과"처럼 읽히지 않게 */}
        <TimerRing remainingMs={answering ? questionRemainingMs : questionTotalMs} totalMs={questionTotalMs} />
      </div>

      <div role="group" aria-label="선택지" data-variant={variant} className="grid grid-cols-2 gap-2.5">
        {slots.map((option, i) =>
          option ? (
            <RegisterButton
              key={option.phraseId}
              phraseId={option.phraseId}
              variant={variant}
              // 가려진 선택지는 표시할 때만 한자를 〇 로 바꾼다 (말하기 매칭·TTS 는 원문을 쓴다)
              ja={option.masked ? maskJa(option.ja) : option.ja}
              reading={option.reading}
              ko={option.ko}
              icon={option.icon}
              masked={option.masked}
              showKo={showKo}
              showKana={showKana}
              state={optionState(option, pressedId, phase)}
              disabled={!answering}
              onClick={() => onAnswer(option.phraseId)}
            />
          ) : (
            <span key={`empty-${i}`} aria-hidden="true" className="min-h-pos-button rounded-xl border-2 border-dashed border-border" />
          ),
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1.5">
        {speechNote ? (
          <p role="status" className="m-0 font-ko text-caption text-ink-muted">
            {speechNote}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2.5">
          <SpeakButton state={speech} interim={interim} disabled={!answering} onSpeak={onSpeak} />
          <div className="flex items-center gap-1.5">
            <Chip selected={showKana} onClick={onToggleKana} aria-label="선택지 후리가나 표시" lang="ja">
              かな
            </Chip>
            <Chip selected={showKo} onClick={onToggleKo} aria-label="선택지 한국어 뜻 표시">
              뜻
            </Chip>
          </div>
        </div>
      </div>
    </section>
  );
}

interface SpeakButtonProps {
  state: SpeechUiState;
  interim: string;
  disabled: boolean;
  onSpeak?: () => void;
}

/**
 * 말하기 버튼. 미지원 브라우저면 자리만 비우고(레이아웃 유지), 해금 전엔 점선 알약,
 * 준비되면 accent 알약, 듣는 중엔 펄스 점 + 중간 인식 텍스트.
 */
function SpeakButton({ state, interim, disabled, onSpeak }: SpeakButtonProps) {
  if (state === "hidden") return <span aria-hidden="true" />;
  if (state === "locked") {
    return (
      <span
        aria-disabled="true"
        title="선배 승급 시 전 시프트에서 해금 · 夕 시프트에선 바로"
        className="inline-flex min-h-touch items-center gap-2 rounded-pill border-[1.5px] border-dashed border-border-strong bg-surface px-3.5 font-ko text-[13px] font-bold text-ink-muted"
      >
        <Icon name="mic" size={16} />
        말하기 · 선배부터
      </span>
    );
  }
  const listening = state === "listening";
  return (
    <button
      type="button"
      onClick={onSpeak}
      disabled={disabled && !listening}
      aria-pressed={listening}
      aria-label={listening ? "듣는 중" : "말하기 · 음성으로 답하기"}
      className={cn(
        "inline-flex min-h-touch max-w-[70%] items-center gap-2 rounded-pill px-3.5 font-ko text-[13px] font-bold transition-colors",
        listening ? "bg-accent text-brand-ink" : "bg-accent-soft text-accent",
        "disabled:opacity-50",
      )}
    >
      {listening ? (
        <span aria-hidden="true" className="inline-block size-2.5 animate-pulse rounded-full bg-brand-ink motion-reduce:animate-none" />
      ) : (
        <Icon name="mic" size={16} />
      )}
      {listening ? (
        <span className="truncate">
          <span lang="ja" className="font-jp">
            聞いてます…
          </span>
          {interim ? <span lang="ja" className="ml-1.5 font-jp font-medium opacity-80">{interim}</span> : null}
        </span>
      ) : (
        <span>
          <span lang="ja" className="font-jp">
            話す
          </span>{" "}
          · 말하기
        </span>
      )}
    </button>
  );
}
