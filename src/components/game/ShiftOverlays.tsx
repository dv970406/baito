"use client";

/**
 * 인게임 위에 덮이는 시트들.
 * - PreShiftSheet: 출근 전 안내(매장·시간대·손님 수·제한시간) + 出勤 CTA
 * - PauseOverlay: 일시정지 — 再開 / やめる(저장 없이 홈으로)
 * - ShiftEndOverlay: 마감 — お疲れさまでした, 점장 호출이면 점장 한마디
 */
import type { ReactNode } from "react";
import type { ManagerLine, ShiftConfig, WorkplaceContent } from "@/engine/types";
import { CtaButton, KanjiBadge, ManagerNote } from "@/components/ui";
import { cn } from "@/lib/cn";

function Backdrop({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={cn("absolute inset-0 z-20 flex flex-col justify-end bg-surface/85", className)}
    >
      {children}
    </div>
  );
}

function Sheet({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-t-panel bg-surface-raised px-screen pb-safe-cta pt-6 shadow-panel-up">
      {children}
    </div>
  );
}

export interface PreShiftSheetProps {
  content: WorkplaceContent;
  config: ShiftConfig;
  /** 복원이 끝나기 전엔 비활성 */
  ready: boolean;
  onStart: () => void;
}

export function PreShiftSheet({ content, config, ready, onStart }: PreShiftSheetProps) {
  return (
    <Backdrop label="출근 준비">
      <Sheet>
        <div className="flex items-center gap-3">
          <KanjiBadge kanji={config.kanji} size="lg" label={`${config.nameKo} 시프트`} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span lang="ja" className="font-jp text-heading text-ink">
              {content.storeNameJa} {content.storeBranchJa}
            </span>
            <span className="font-ko text-caption text-ink-muted">
              {config.nameKo} 시프트 · {config.hours} · {content.registerLabel}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2.5">
          <Fact label="손님" value={`${config.customerCount}名`} />
          <Fact label="한 질문" value={`${config.questionTimeSec}秒`} />
          <Fact label="시프트" value={`${Math.round(config.durationSec / 60)}分`} />
        </dl>
        <p className="m-0 font-ko text-caption text-ink-muted">{config.descriptionKo}</p>
        <CtaButton variant="primary" icon="play" onClick={onStart} disabled={!ready} loading={!ready}>
          {ready ? "出勤" : "出勤準備中…"}
        </CtaButton>
      </Sheet>
    </Backdrop>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface-sunken px-3 py-2.5">
      <dt className="font-ko text-label text-ink-muted">{label}</dt>
      <dd className="m-0 font-num text-money text-ink">{value}</dd>
    </div>
  );
}

export interface PauseOverlayProps {
  onResume: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onQuit }: PauseOverlayProps) {
  return (
    <Backdrop label="일시정지">
      <Sheet>
        <div className="flex flex-col gap-1">
          <span lang="ja" className="font-jp text-heading text-ink">
            休憩中
          </span>
          <span className="font-ko text-caption text-ink-muted">손님은 기다리고 있어요. 그만두면 이번 시프트는 기록되지 않아요.</span>
        </div>
        <CtaButton variant="primary" icon="play" onClick={onResume} autoFocus>
          再開
        </CtaButton>
        <button
          type="button"
          onClick={onQuit}
          className="inline-flex min-h-touch w-full items-center justify-center rounded-pill font-jp text-[15px] font-bold text-ink-muted focus-visible:shadow-focus"
        >
          やめる <span className="ml-1.5 font-ko text-caption font-medium">· 홈으로</span>
        </button>
      </Sheet>
    </Backdrop>
  );
}

export interface ShiftEndOverlayProps {
  endedBy: "time" | "customers" | "manager";
  /** 점장 호출일 때 보여줄 한마디 */
  managerLine: ManagerLine | null;
  onContinue: () => void;
}

export function ShiftEndOverlay({ endedBy, managerLine, onContinue }: ShiftEndOverlayProps) {
  const title = endedBy === "manager" ? "店長が来た" : "お疲れさまでした";
  const sub =
    endedBy === "manager"
      ? "손님 세 명이 연속으로 돌아갔어요. 오늘은 여기까지."
      : endedBy === "time"
        ? "시간이 다 됐어요. 마감 영수증을 뽑는 중…"
        : "마지막 손님까지 응대했어요. 마감 영수증을 뽑는 중…";
  return (
    <Backdrop label="마감">
      <Sheet>
        <div className="flex flex-col gap-1">
          <span lang="ja" className="font-jp text-heading text-ink" role="status">
            {title}
          </span>
          <span className="font-ko text-caption text-ink-muted">{sub}</span>
        </div>
        {managerLine ? <ManagerNote ja={managerLine.ja} ko={managerLine.ko} variant="card" /> : null}
        <CtaButton variant="primary" icon="receipt" onClick={onContinue}>
          영수증 보기
        </CtaButton>
      </Sheet>
    </Backdrop>
  );
}
