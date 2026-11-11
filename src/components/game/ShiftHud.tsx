"use client";

/**
 * 인게임 상단 HUD — 시간대 배지 + 매장 시계 · 손님 진행 수 · 콤보 칩 · 일시정지.
 * 디자인(Main.dc.html)의 상단 줄과 6px 진행 바를 그대로 따른다.
 */
import type { ShiftConfig } from "@/engine/types";
import { ComboChip, KanjiBadge, ProgressBar } from "@/components/ui";
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
}

export function ShiftHud({ config, progress, elapsedRatio, handled, combo, paused, onPause }: ShiftHudProps) {
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
    </header>
  );
}
