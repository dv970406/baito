"use client";

/**
 * 인게임 상단 HUD — 시간대 배지 + 매장 시계 · 손님 진행 수 · 콤보 칩 · 일시정지.
 * 디자인(Main.dc.html)의 상단 줄과 6px 진행 바를 그대로 따른다.
 * 승급 시험(店長点検)이면 진행 바 아래에 조건 줄(콤보 기준 · 이탈 0)이 붙는다.
 */
import type { ReactNode } from "react";
import type { ExamContext, ShiftConfig } from "@/engine/types";
import { Badge, ComboChip, KanjiBadge, ProgressBar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { storeClock } from "./shiftModel";

export interface ShiftHudProps {
  config: ShiftConfig;
  /** 0~1 시프트 진행도 */
  progress: number;
  /** 시프트 경과 비율 (매장 시계용) 0~1 */
  elapsedRatio: number;
  /** 처리한 손님 수 (응대 + 이탈) */
  handled: number;
  combo: number;
  paused: boolean;
  onPause: () => void;
  /** 승급 시험이면 그 정보 — 「店長点検」 배지와 조건 칩 */
  exam?: ExamContext | null;
  /** 이번 시프트 최고 콤보 (시험 조건 진행) */
  maxCombo?: number;
  /** 이탈 손님 수 — 시험 중 1 이상이면 조건 칩이 실패 색으로 */
  missed?: number;
}

export function ShiftHud({
  config,
  progress,
  elapsedRatio,
  handled,
  combo,
  paused,
  onPause,
  exam = null,
  maxCombo = 0,
  missed = 0,
}: ShiftHudProps) {
  return (
    <header className="px-screen">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KanjiBadge kanji={config.kanji} label={`${config.nameKo} 시프트`} />
          <div className="flex flex-col">
            <span className="font-ko text-caption text-ink-muted">{config.nameKo} 시프트</span>
            <span className="font-num text-money tabular-nums text-ink" aria-label="매장 시각">
              {storeClock(config.hours, elapsedRatio)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col items-end">
            <span className="font-ko text-label text-ink-muted">손님</span>
            <span className="font-num text-money tabular-nums text-ink">
              {handled}
              <span className="text-ink-muted">/{config.customerCount}</span>
            </span>
          </div>
          {combo >= 2 ? <ComboChip n={combo} /> : null}
          <button
            type="button"
            onClick={onPause}
            aria-label={paused ? "일시정지 중" : "일시정지"}
            aria-pressed={paused}
            className="inline-flex size-touch items-center justify-center rounded-pill bg-surface-raised text-ink shadow-hairline focus-visible:shadow-focus"
          >
            <span aria-hidden="true" className="flex items-center gap-[3px]">
              <span className="h-3.5 w-1 rounded-xs bg-ink" />
              <span className="h-3.5 w-1 rounded-xs bg-ink" />
            </span>
          </button>
        </div>
      </div>
      <ProgressBar value={progress} label="시프트 진행" className="mt-3" />
      {exam ? <ExamStrip exam={exam} maxCombo={maxCombo} missed={missed} /> : null}
    </header>
  );
}

/**
 * 시험 조건 줄: 「店長点検」 배지 + 조건 칩 둘.
 * - 콤보 칩: 기준 이상을 한 번 넘기면 perfect 색, 아니면 현재 최고 콤보/기준
 * - 이탈 칩: 0 이면 그대로, 한 명이라도 돌아갔으면 irritation(실패) 색
 */
function ExamStrip({ exam, maxCombo, missed }: { exam: ExamContext; maxCombo: number; missed: number }) {
  const comboMet = maxCombo >= exam.comboRequired;
  const failed = missed > 0;
  return (
    <div role="group" aria-label="점장 점검 조건" data-exam className="mt-2 flex items-center gap-1.5">
      <Badge tone="tip" size="sm" lang="ja" aria-label="점장 점검 시프트">
        店長点検
      </Badge>
      <ConditionChip
        tone={comboMet ? "met" : "pending"}
        label={`콤보 조건 ${exam.comboRequired} 이상 · 현재 최고 ${maxCombo}`}
      >
        <span lang="ja" className="font-jp">
          コンボ
        </span>
        <span className="ml-1 font-num tabular-nums">
          ×{maxCombo}
          <span className={cn(!comboMet && "text-ink-muted")}>/{exam.comboRequired}</span>
        </span>
      </ConditionChip>
      <ConditionChip
        tone={failed ? "failed" : "met"}
        label={failed ? `손님 이탈 ${missed} · 조건 실패` : "손님 이탈 0"}
        data-failed={failed ? "true" : undefined}
      >
        <span lang="ja" className="font-jp">
          離脱
        </span>
        <span className="ml-1 font-num tabular-nums">{missed}</span>
      </ConditionChip>
    </div>
  );
}

type ConditionTone = "pending" | "met" | "failed";
const CONDITION_CLASS: Record<ConditionTone, string> = {
  pending: "bg-surface-sunken text-ink",
  met: "bg-perfect-soft text-perfect-ink",
  failed: "bg-irritation-soft text-irritation-ink",
};

/** 시험 조건 칩 — Badge(sm)와 같은 크기, 상태색만 셋(대기·충족·실패) */
function ConditionChip({
  tone,
  label,
  children,
  ...rest
}: {
  tone: ConditionTone;
  label: string;
  children: ReactNode;
  "data-failed"?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      data-tone={tone}
      {...rest}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-pill px-2 py-[3px] text-label font-extrabold leading-none tracking-normal",
        CONDITION_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}
