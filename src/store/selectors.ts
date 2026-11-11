import type { RankDef, ShiftSlot } from "@/engine/types";
import { availableShiftSlots, nextShiftSlot, rankFor, unlockedTags } from "@/engine/progression";
import type { PlayerProfile } from "@/shared/player";
import { localYmd } from "./date";

/** 직급 진행 상태 */
export function selectRank(profile: PlayerProfile, ranks: RankDef[]) {
  return rankFor(profile.totalShifts, ranks);
}

/** 승급으로 해금된 태그 */
export function selectUnlockedTags(profile: PlayerProfile, ranks: RankDef[]) {
  return unlockedTags(profile.totalShifts, ranks);
}

/** 오늘 출근 가능한 시프트 (아침 → 점심 → 저녁 순서로 열림) */
export function selectAvailableSlots(profile: PlayerProfile, today: string = localYmd()): ShiftSlot[] {
  return availableShiftSlots(profile.today, today);
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
