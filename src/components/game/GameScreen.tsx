"use client";

/**
 * 01 KONBINI 인게임 화면 진입점.
 * - 세이브 복원 전: 출근 준비 시트(비활성)만 보여준다
 * - 복원 후: 오늘 출근 가능한 시프트인지 확인하고, 클라이언트에서 시드를 한 번 만들어 ShiftBoard 를 띄운다
 *   (Date.now/Math.random 은 Cache Components 규칙상 서버 프리렌더에 들어가면 안 되므로,
 *    복원(hydrated) 뒤에만 마운트되는 자식의 상태 초기화에서 만든다)
 */
import { useState } from "react";
import type { ExamContext, ItemTag, Regular, ShiftSlot } from "@/engine/types";
import { konbini } from "@/content";
import { Card, CtaButton, Screen } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { localYmd } from "@/store/date";
import { selectAvailableSlots, selectExam, selectUnlockedTags } from "@/store/selectors";
import { ShiftBoard } from "./ShiftBoard";
import { PreShiftSheet } from "./ShiftOverlays";
import { availableRegulars, isSpeakingUnlocked } from "./shiftModel";

import { EXAM_SLOT, type GameSlot } from "./gameSlot";

export { EXAM_SLOT, type GameSlot };

export interface GameScreenProps {
  /** 시간대, 또는 "exam"(점장 점검 시프트 — 시간대는 다음 직급의 시험 규칙이 정한다) */
  slot: GameSlot;
  /** 테스트용: 시드를 고정한다 */
  seedOverride?: number;
}

/** 부팅 시점(복원 직후)의 프로필로 고정한 시프트 입력. 시프트 도중 프로필이 바뀌어도 손님은 그대로다 */
interface Boot {
  seed: number;
  /** 실제로 플레이하는 시간대(시험이면 시험 규칙의 시간대) */
  slot: ShiftSlot;
  /** 승급 시험이면 그 정보, 아니면 null */
  exam: ExamContext | null;
  /** 시험인데 지금 볼 수 없는 이유(없으면 null) */
  examBlocked: "not-ready" | "taken" | null;
  /** 플레이 중인 달(1~12) */
  month: number;
  available: ShiftSlot[];
  regulars: Regular[];
  unlockedTags: ItemTag[];
  /** 말하기 모드(음성 인식) 해금 여부 */
  speakingUnlocked: boolean;
}

const SLOT_KO: Record<ShiftSlot, string> = { asa: "아침", hiru: "점심", yoru: "저녁", shinya: "심야" };

export function GameScreen({ slot, seedOverride }: GameScreenProps) {
  const hydrated = useGameStore((s) => s.hydrated);

  // 복원 전(SSR 포함)에는 출근 준비 시트만. 시드·오늘 날짜는 복원 뒤 클라이언트에서만 만든다
  if (!hydrated) {
    // 시험은 시간대를 복원 뒤에야 알 수 있으므로 시트 대신 상태 문구만 보여준다
    const config = slot === EXAM_SLOT ? null : konbini.shifts[slot];
    return (
      <Screen
        tone="surface"
        theme={slot === "yoru" || slot === "shinya" ? "shinya" : undefined}
        workplace="konbini"
        className="h-dvh overflow-hidden"
      >
        <p className="sr-only" role="status">
          出勤準備中…
        </p>
        {config ? <PreShiftSheet content={konbini} config={config} ready={false} onStart={() => undefined} /> : null}
      </Screen>
    );
  }

  return <HydratedGame slot={slot} seedOverride={seedOverride} />;
}

/** 복원 뒤에만 마운트된다 — 시드와 오늘 날짜를 상태 초기화 때 한 번 만든다 */
function HydratedGame({ slot: requested, seedOverride }: GameScreenProps) {
  const [boot] = useState<Boot>(() => {
    const now = new Date();
    const today = localYmd(now);
    const month = now.getMonth() + 1;
    const profile = useGameStore.getState().profile;
    // 승급 시험: 다음 직급의 시험 규칙이 시간대·콤보 기준을 정한다
    const examState = requested === EXAM_SLOT ? selectExam(profile, konbini.ranks, today) : null;
    const examRule = examState?.target && examState.rule ? examState : null;
    const slot: ShiftSlot = requested === EXAM_SLOT ? (examRule?.rule?.slot ?? "asa") : requested;
    const exam: ExamContext | null =
      examRule?.target && examRule.rule ? { rank: examRule.target.id, comboRequired: examRule.rule.combo } : null;
    const examBlocked: Boot["examBlocked"] =
      requested !== EXAM_SLOT ? null : !examState?.ready ? "not-ready" : examState.takenThisWeek ? "taken" : null;
    return {
      seed: seedOverride ?? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0,
      slot,
      exam,
      examBlocked,
      month,
      available: selectAvailableSlots(profile, today, { shifts: konbini.shifts, ranks: konbini.ranks }),
      regulars: availableRegulars(konbini, profile, slot, month),
      unlockedTags: selectUnlockedTags(profile, konbini.ranks),
      speakingUnlocked: isSpeakingUnlocked(profile, konbini.shifts[slot], konbini.ranks),
    };
  });
  const { slot } = boot;
  const config = konbini.shifts[slot];

  if (requested === EXAM_SLOT && (boot.examBlocked || !boot.exam)) {
    return (
      <Screen tone="surface" workplace="konbini">
        <div className="flex flex-1 flex-col justify-center px-screen pb-safe-cta">
          <Card variant="raised" padding="lg" radius="3xl" className="flex flex-col gap-3">
            <span lang="ja" className="font-jp text-heading text-ink">
              店長点検はまだ
            </span>
            <p className="m-0 font-ko text-body text-ink">
              {boot.examBlocked === "taken" ? "이번 주 점장 점검은 이미 봤어요." : "아직 점장 점검을 볼 수 없어요."}
            </p>
            <p className="m-0 font-ko text-caption text-ink-muted">
              {boot.examBlocked === "taken" ? "다음 주 월요일에 다시 볼 수 있어요." : "시프트를 더 채우면 점장이 불러요."}
            </p>
            <CtaButton as="link" href="/konbini" variant="primary" icon="calendar">
              시프트 표로
            </CtaButton>
          </Card>
        </div>
      </Screen>
    );
  }

  // 시험은 오늘 시프트 표와 무관하게(추가 근무) 볼 수 있다
  if (!boot.exam && !boot.available.includes(slot)) {
    // 열려 있는 마지막 시프트 = 지금 먼저 끝내야 하는 시프트
    const first = boot.available.at(-1);
    return (
      <Screen tone="surface" workplace="konbini">
        <div className="flex flex-1 flex-col justify-center px-screen pb-safe-cta">
          <Card variant="raised" padding="lg" radius="3xl" className="flex flex-col gap-3">
            <span lang="ja" className="font-jp text-heading text-ink">
              {config.kanji}シフトはまだ
            </span>
            <p className="m-0 font-ko text-body text-ink">이 시프트는 지금 출근할 수 없어요.</p>
            <p className="m-0 font-ko text-caption text-ink-muted">
              {first ? `${SLOT_KO[first]} 시프트를 먼저 끝내면 열려요.` : "오늘 시프트는 모두 끝났어요."}
            </p>
            <CtaButton as="link" href="/konbini" variant="primary" icon="calendar">
              시프트 표로
            </CtaButton>
          </Card>
        </div>
      </Screen>
    );
  }

  return (
    <ShiftBoard
      content={konbini}
      slot={slot}
      seed={boot.seed}
      regularsAvailable={boot.regulars}
      unlockedTags={boot.unlockedTags}
      speakingUnlocked={boot.speakingUnlocked}
      month={boot.month}
      exam={boot.exam}
    />
  );
}
