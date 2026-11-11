"use client";

/**
 * 01 KONBINI 인게임 화면 진입점.
 * - 세이브 복원 전: 출근 준비 시트(비활성)만 보여준다
 * - 복원 후: 오늘 출근 가능한 시프트인지 확인하고, 클라이언트에서 시드를 한 번 만들어 ShiftBoard 를 띄운다
 *   (Date.now/Math.random 은 Cache Components 규칙상 서버 프리렌더에 들어가면 안 되므로,
 *    복원(hydrated) 뒤에만 마운트되는 자식의 상태 초기화에서 만든다)
 */
import { useState } from "react";
import type { ItemTag, Regular, ShiftSlot } from "@/engine/types";
import { konbini } from "@/content";
import { Card, CtaButton, Screen } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { localYmd } from "@/store/date";
import { selectAvailableSlots, selectUnlockedTags } from "@/store/selectors";
import { ShiftBoard } from "./ShiftBoard";
import { PreShiftSheet } from "./ShiftOverlays";
import { availableRegulars } from "./shiftModel";

export interface GameScreenProps {
  slot: ShiftSlot;
  /** 테스트용: 시드를 고정한다 */
  seedOverride?: number;
}

/** 부팅 시점(복원 직후)의 프로필로 고정한 시프트 입력. 시프트 도중 프로필이 바뀌어도 손님은 그대로다 */
interface Boot {
  seed: number;
  available: ShiftSlot[];
  regulars: Regular[];
  unlockedTags: ItemTag[];
}

const SLOT_KO: Record<ShiftSlot, string> = { asa: "아침", hiru: "점심", yoru: "저녁" };

export function GameScreen({ slot, seedOverride }: GameScreenProps) {
  const hydrated = useGameStore((s) => s.hydrated);
  const config = konbini.shifts[slot];

  // 복원 전(SSR 포함)에는 출근 준비 시트만. 시드·오늘 날짜는 복원 뒤 클라이언트에서만 만든다
  if (!hydrated) {
    return (
      <Screen
        tone="surface"
        theme={slot === "yoru" ? "shinya" : undefined}
        workplace="konbini"
        className="h-dvh overflow-hidden"
      >
        <p className="sr-only" role="status">
          出勤準備中…
        </p>
        <PreShiftSheet content={konbini} config={config} ready={false} onStart={() => undefined} />
      </Screen>
    );
  }

  return <HydratedGame slot={slot} seedOverride={seedOverride} />;
}

/** 복원 뒤에만 마운트된다 — 시드와 오늘 날짜를 상태 초기화 때 한 번 만든다 */
function HydratedGame({ slot, seedOverride }: GameScreenProps) {
  const config = konbini.shifts[slot];
  const [boot] = useState<Boot>(() => {
    const now = new Date();
    const profile = useGameStore.getState().profile;
    return {
      seed: seedOverride ?? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0,
      available: selectAvailableSlots(profile, localYmd(now)),
      regulars: availableRegulars(konbini, profile, slot, now.getMonth() + 1),
      unlockedTags: selectUnlockedTags(profile, konbini.ranks),
    };
  });

  if (!boot.available.includes(slot)) {
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
    />
  );
}
