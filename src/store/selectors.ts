import type { RankDef, ShiftConfig, ShiftSlot } from "@/engine/types";
import {
  availableShiftSlots,
  examAvailability,
  nextShiftSlot,
  rankOf,
  unlockedTags,
  weekStartOf,
} from "@/engine/progression";
import type { PlayerProfile } from "@/shared/player";
import { localYmd } from "./date";

/** 직급 진행 상태 */
export function selectRank(profile: PlayerProfile, ranks: RankDef[]) {
  return rankOf(profile.rank, profile.totalShifts, ranks);
}

/** 승급으로 해금된 태그 */
export function selectUnlockedTags(profile: PlayerProfile, ranks: RankDef[]) {
  return unlockedTags(profile.rank, ranks);
}

/** 승급 시험 응시 가능 여부 (주 1회) */
export function selectExam(profile: PlayerProfile, ranks: RankDef[], today: string = localYmd()) {
  return examAvailability(
    { rank: profile.rank, totalShifts: profile.totalShifts, examWeek: profile.examWeek },
    ranks,
    weekStartOf(today),
  );
}

/**
 * 오늘 출근 가능한 시프트 (아침 → 점심 → 저녁 순서로 열림, 셋 다 끝내면 직급 조건을 채운 심야).
 * shifts/ranks 를 주면 추가 시프트(심야)까지 판정한다.
 */
export function selectAvailableSlots(
  profile: PlayerProfile,
  today: string = localYmd(),
  opts: { shifts?: Record<ShiftSlot, ShiftConfig>; ranks?: RankDef[] } = {},
): ShiftSlot[] {
  return availableShiftSlots(profile.today, today, { rank: profile.rank, ranks: opts.ranks, shifts: opts.shifts });
}

/** 오늘 다음에 할 시프트 (모두 끝났으면 null) */
export function selectNextSlot(profile: PlayerProfile, today: string = localYmd()): ShiftSlot | null {
  return nextShiftSlot(profile.today, today);
}

/** 오늘 완료한 시프트 목록 (날짜가 지났으면 빈 배열) */
export function selectCompletedToday(profile: PlayerProfile, today: string = localYmd()): ShiftSlot[] {
  return profile.today.date === today ? profile.today.completed : [];
}

/** 레귤러 중 한 번 이상 만난 수 */
export function selectRegularsMetCount(profile: PlayerProfile): number {
  return Object.values(profile.regulars).filter((r) => r.metCount > 0).length;
}
