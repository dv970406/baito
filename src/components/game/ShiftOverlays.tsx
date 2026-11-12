"use client";

/**
 * 인게임 위에 덮이는 시트들.
 * - PreShiftSheet: 출근 전 안내(매장·시간대·손님 수·제한시간) + 出勤 CTA
 * - PauseOverlay: 일시정지 — 再開 / やめる(저장 없이 홈으로)
 * - ShiftEndOverlay: 마감 — お疲れさまでした, 점장 호출이면 점장 한마디
 */
import type { ReactNode } from "react";
import type { ExamContext, ExamResult, ManagerLine, Season, ShiftConfig, WorkplaceContent } from "@/engine/types";
import { Badge, CaptionLangToggle, CtaButton, KanjiBadge, ManagerNote } from "@/components/ui";
import { cap, capPair } from "@/i18n/caption";
import { useT } from "@/i18n/useT";
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
  /** 승급 시험(점장 점검)이면 제목이 店長点検 으로 바뀌고 합격 조건이 보인다 */
  exam?: ExamContext | null;
  /** 이번 달 시즌 — 규칙 변경이 있으면 「今月の変更」 한 줄 */
  season?: Season | null;
}

export function PreShiftSheet({ content, config, ready, onStart, exam = null, season = null }: PreShiftSheetProps) {
  const { t, lang } = useT();
  const notice = season?.rule && season.noticeJa ? season : null;
  const shiftName = t("common.shiftName", { name: capPair(config.nameKo, config.nameEn, lang) });
  const noticeSub = notice ? capPair(notice.noticeKo ?? "", notice.noticeEn, lang) : "";
  return (
    <Backdrop label={exam ? t("overlay.examPrep") : t("overlay.prep")}>
      <Sheet>
        <div className="flex items-center gap-3">
          <KanjiBadge kanji={config.kanji} size="lg" tone={exam ? "tip" : "accent"} label={shiftName} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span lang="ja" className="font-jp text-heading text-ink">
              {exam ? "店長点検" : `${content.storeNameJa} ${content.storeBranchJa}`}
            </span>
            <span className="font-ko text-caption text-ink-muted">
              {exam ? t("overlay.examSub", { name: capPair(config.nameKo, config.nameEn, lang) }) : shiftName} · {config.hours} ·{" "}
              {content.registerLabel}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2.5">
          <Fact label={t("overlay.customers")} value={`${config.customerCount}名`} />
          <Fact label={t("overlay.perQuestion")} value={`${config.questionTimeSec}秒`} />
          <Fact label={t("overlay.shift")} value={`${Math.round(config.durationSec / 60)}分`} />
        </dl>
        {exam ? (
          <p className="m-0 flex flex-wrap items-center gap-1.5 font-ko text-caption text-ink" data-exam-rule>
            <Badge tone="tip" size="sm" lang="ja">
              合格条件
            </Badge>
            <span>
              {t("overlay.examRuleCombo")} <span className="font-num font-extrabold">×{exam.comboRequired}</span>{" "}
              {t("overlay.examRuleRest")}
            </span>
          </p>
        ) : (
          <p className="m-0 font-ko text-caption text-ink-muted">{capPair(config.descriptionKo, config.descriptionEn, lang)}</p>
        )}
        {notice ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-sunken px-3.5 py-3" data-season-notice>
            <Badge tone="accent" size="sm" lang="ja">
              今月の変更
            </Badge>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span lang="ja" className="font-jp text-bubble text-ink">
                {notice.noticeJa}
              </span>
              {noticeSub ? <span className="font-ko text-caption text-ink-muted">{noticeSub}</span> : null}
            </div>
          </div>
        ) : null}
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
  const { t } = useT();
  return (
    <Backdrop label={t("overlay.pause")}>
      <Sheet>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span lang="ja" className="font-jp text-heading text-ink">
              休憩中
            </span>
            <span className="font-ko text-caption text-ink-muted">{t("overlay.pauseBody")}</span>
          </div>
          <CaptionLangToggle className="shrink-0" />
        </div>
        <CtaButton variant="primary" icon="play" onClick={onResume} autoFocus>
          再開
        </CtaButton>
        <button
          type="button"
          onClick={onQuit}
          className="inline-flex min-h-touch w-full items-center justify-center rounded-pill font-jp text-[15px] font-bold text-ink-muted focus-visible:shadow-focus"
        >
          やめる <span className="ml-1.5 font-ko text-caption font-medium">· {t("common.home")}</span>
        </button>
      </Sheet>
    </Backdrop>
  );
}

export interface ShiftEndOverlayProps {
  endedBy: "time" | "customers" | "manager";
  /** 점장 호출일 때, 또는 시험 결과(exam_pass/exam_fail)일 때 보여줄 한마디 */
  managerLine: ManagerLine | null;
  /** 승급 시험이었으면 결과 — 합격/불합격 한 줄 */
  exam?: ExamResult | null;
  onContinue: () => void;
}

export function ShiftEndOverlay({ endedBy, managerLine, exam = null, onContinue }: ShiftEndOverlayProps) {
  const { t, lang } = useT();
  const title = endedBy === "manager" ? "店長が来た" : "お疲れさまでした";
  const sub =
    endedBy === "manager"
      ? t("overlay.endManager")
      : endedBy === "time"
        ? t("overlay.endTime")
        : t("overlay.endCustomers");
  return (
    <Backdrop label={t("overlay.end")}>
      <Sheet>
        <div className="flex flex-col gap-1">
          <span lang="ja" className="font-jp text-heading text-ink" role="status">
            {title}
          </span>
          <span className="font-ko text-caption text-ink-muted">{sub}</span>
        </div>
        {exam ? (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3.5 py-3",
              exam.passed ? "bg-perfect-soft" : "bg-irritation-soft",
            )}
            data-exam-result={exam.passed ? "pass" : "fail"}
          >
            <Badge tone="tip" size="sm" lang="ja">
              店長点検
            </Badge>
            <span lang="ja" className={cn("font-jp text-heading", exam.passed ? "text-perfect-ink" : "text-irritation-ink")}>
              {exam.passed ? "合格" : "不合格"}
            </span>
            <span className="font-ko text-caption text-ink-muted">
              {exam.passed ? t("overlay.examPass") : t("overlay.examFail", { combo: exam.comboRequired })}
            </span>
          </div>
        ) : null}
        {managerLine ? <ManagerNote ja={managerLine.ja} ko={cap(managerLine, lang)} variant="card" /> : null}
        <CtaButton variant="primary" icon="receipt" onClick={onContinue}>
          {t("overlay.viewReceipt")}
        </CtaButton>
      </Sheet>
    </Backdrop>
  );
}
