import type { ItemTag, ShiftSlot, TagWeights } from "@/engine/types";

/** 레귤러 1명에 대한 플레이어의 진행 상태 */
export interface RegularState {
  /** 호감도 0~5 */
  affinity: number;
  /** 만난 횟수 */
  metCount: number;
  /** 마지막으로 만난 날짜 (YYYY-MM-DD, 로컬) */
  lastMetDate: string | null;
  /** 처음 들은 말(ja) 수집 목록 */
  firstWordsHeard: string[];
}

/** 오늘(로컬 날짜) 완료한 시프트 */
export interface TodayProgress {
  date: string;
  completed: ShiftSlot[];
}

/**
 * 플레이어 프로필 = 이력서에 남는 모든 것.
 * 로컬(localStorage)에 우선 저장되고 서버(Supabase)와 last-write-wins 로 동기화된다.
 */
export interface PlayerProfile {
  name: string;
  /** 현재 시급(¥) */
  wage: number;
  /** 누적 완료 시프트 수 (승급 기준) */
  totalShifts: number;
  /** 연속 출근 일수 */
  streak: number;
  /** 마지막 출근 날짜 (YYYY-MM-DD, 로컬) */
  lastPlayDate: string | null;
  /** 이번 달 남은 유급휴가 (월 2회, 하루 빠져도 스트릭 유지) */
  leavesLeft: number;
  /** leavesLeft 가 적용되는 달 (YYYY-MM) */
  leaveMonth: string;
  /** 위장 SRS 가중치 */
  tagWeights: TagWeights;
  /** Perfect 를 한 번 이상 낸 태그 */
  perfectedTags: ItemTag[];
  regulars: Record<string, RegularState>;
  today: TodayProgress;
  /** ISO 날짜시간 — 동기화 충돌 해결 기준 */
  updatedAt: string;
}

export const DEFAULT_WAGE = 1000;
export const LEAVES_PER_MONTH = 2;
