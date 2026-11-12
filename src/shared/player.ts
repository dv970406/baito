import type { ItemTag, RankId, ShiftSlot, TagWeights } from "@/engine/types";
import { ITEM_TAGS, RANK_IDS, SHIFT_SLOTS } from "@/engine/types";

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
  /** 누적 완료 시프트 수 (승급 시험 자격 기준) */
  totalShifts: number;
  /** 현재 직급 — 승급 시험(점장 점검 시프트) 합격으로만 올라간다 */
  rank: RankId;
  /** 마지막으로 승급 시험을 본 주(월요일 YYYY-MM-DD). 주 1회만 */
  examWeek: string | null;
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

/** 직급 정의 — shiftsRequired 를 채운 가장 높은 직급(시험 제도 이전 세이브 변환용). 엔진 콘텐츠와 같아야 한다 */
const LEGACY_RANK_STEPS: readonly { id: RankId; shiftsRequired: number }[] = [
  { id: "shinjin", shiftsRequired: 0 },
  { id: "ippan", shiftsRequired: 3 },
  { id: "senpai", shiftsRequired: 10 },
  { id: "leader", shiftsRequired: 20 },
  { id: "fukutencho", shiftsRequired: 35 },
  { id: "tencho", shiftsRequired: 50 },
];

/**
 * 저장된 프로필(예전 버전 포함)을 현재 계약에 맞춘다.
 * - 새 태그의 가중치는 1 로 채운다
 * - rank 가 없으면 누적 시프트 수로 유도한다(기존 플레이어는 직급을 잃지 않는다)
 * - examWeek 기본 null, 모르는 시프트 슬롯은 completed 에서 뺀다
 */
export function normalizeProfile(raw: PlayerProfile | (Partial<PlayerProfile> & { totalShifts?: number })): PlayerProfile {
  const totalShifts = raw.totalShifts ?? 0;
  const tagWeights = {} as TagWeights;
  for (const tag of ITEM_TAGS) {
    const v = raw.tagWeights?.[tag];
    tagWeights[tag] = typeof v === "number" && Number.isFinite(v) ? v : 1;
  }
  let rank: RankId = "shinjin";
  if (raw.rank && (RANK_IDS as readonly string[]).includes(raw.rank)) {
    rank = raw.rank;
  } else {
    for (const step of LEGACY_RANK_STEPS) if (totalShifts >= step.shiftsRequired) rank = step.id;
  }
  const today = raw.today ?? { date: "1970-01-01", completed: [] };
  return {
    name: raw.name ?? "알바생",
    wage: raw.wage ?? DEFAULT_WAGE,
    totalShifts,
    rank,
    examWeek: raw.examWeek ?? null,
    streak: raw.streak ?? 0,
    lastPlayDate: raw.lastPlayDate ?? null,
    leavesLeft: raw.leavesLeft ?? LEAVES_PER_MONTH,
    leaveMonth: raw.leaveMonth ?? "1970-01",
    tagWeights,
    perfectedTags: (raw.perfectedTags ?? []).filter((t) => (ITEM_TAGS as readonly string[]).includes(t)),
    regulars: raw.regulars ?? {},
    today: {
      date: today.date,
      completed: (today.completed ?? []).filter((s) => (SHIFT_SLOTS as readonly string[]).includes(s)),
    },
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
  };
}
