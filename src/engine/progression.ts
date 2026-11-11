/**
 * 메타 진행: 시급 변동, 승급, 스트릭(연속 출근), 레귤러 호감도, 시프트 슬롯 해금.
 * 모두 순수 함수 — 오늘 날짜는 'YYYY-MM-DD' 문자열 인자로 받는다.
 */
import { LEAVES_PER_MONTH } from "@/shared/player";
import type { RegularState, TodayProgress } from "@/shared/player";
import { SHIFT_SLOTS } from "./types";
import type { ItemTag, RankDef, RankId, Regular, ShiftSlot } from "./types";

/* ───────────────────────── 시급 ───────────────────────── */

export interface WageStats {
  perfects: number;
  goods: number;
  oks: number;
  lates: number;
  wrongs: number;
  missed: number;
  maxCombo: number;
  firstSuccessTags: ItemTag[];
}

/** 시급 하한(¥) */
export const WAGE_FLOOR = 900;
/** 시프트 1회 시급 변동 범위 */
export const WAGE_DELTA_MIN = -80;
export const WAGE_DELTA_MAX = 160;

/**
 * 시프트 결과 → 시급 변동(¥).
 * perfects×4 + goods×2 + oks×1 + maxCombo×2 − wrongs×1 − missed×25 + firstSuccessTags×40, [-80, 160] 로 클램프.
 * (late 는 정답이지만 보너스 없음)
 */
export function computeWageDelta(s: WageStats): number {
  const raw =
    s.perfects * 4 +
    s.goods * 2 +
    s.oks * 1 +
    s.maxCombo * 2 -
    s.wrongs * 1 -
    s.missed * 25 +
    s.firstSuccessTags.length * 40;
  return Math.max(WAGE_DELTA_MIN, Math.min(WAGE_DELTA_MAX, raw));
}

/* ───────────────────────── 승급 ───────────────────────── */

export interface RankProgress {
  current: RankDef;
  /** 다음 직급. 최고 직급이면 null */
  next: RankDef | null;
  /** 다음 직급까지 남은 시프트 수 (최고 직급이면 0) */
  shiftsToNext: number;
  /** 현재 직급 구간 안에서의 진행도 0~1 (최고 직급이면 1) */
  progress: number;
}

/** shiftsRequired 오름차순으로 정렬된 복사본 */
function sortedRanks(ranks: RankDef[]): RankDef[] {
  return ranks.slice().sort((a, b) => a.shiftsRequired - b.shiftsRequired);
}

/** 누적 시프트 수 → 현재 직급과 다음 직급까지의 진행도 */
export function rankFor(totalShifts: number, ranks: RankDef[]): RankProgress {
  const sorted = sortedRanks(ranks);
  if (sorted.length === 0) {
    throw new Error("rankFor: 직급 정의가 비어 있다");
  }
  let currentIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (totalShifts >= sorted[i].shiftsRequired) currentIdx = i;
  }
  const current = sorted[currentIdx];
  const next = currentIdx + 1 < sorted.length ? sorted[currentIdx + 1] : null;
  if (!next) {
    return { current, next: null, shiftsToNext: 0, progress: 1 };
  }
  const span = Math.max(1, next.shiftsRequired - current.shiftsRequired);
  const done = Math.max(0, totalShifts - current.shiftsRequired);
  return {
    current,
    next,
    shiftsToNext: Math.max(0, next.shiftsRequired - totalShifts),
    progress: Math.min(1, done / span),
  };
}

/** 도달한 모든 직급의 unlocksTags 합집합 */
export function unlockedTags(totalShifts: number, ranks: RankDef[]): ItemTag[] {
  const set = new Set<ItemTag>();
  for (const rank of ranks) {
    if (totalShifts >= rank.shiftsRequired) {
      for (const tag of rank.unlocksTags) set.add(tag);
    }
  }
  return Array.from(set);
}

/* ───────────────────────── 날짜 유틸 ───────────────────────── */

/** 'YYYY-MM-DD' → UTC 기준 epoch day. 타임존 영향 없음 */
function ymdToDays(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error(`dayDiff: 잘못된 날짜 형식 '${ymd}'`);
  }
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** from → to 가 며칠 뒤인지 (to 가 과거면 음수). UTC 로 파싱해 DST·타임존 문제를 피한다 */
export function dayDiff(fromYmd: string, toYmd: string): number {
  return ymdToDays(toYmd) - ymdToDays(fromYmd);
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
function monthOf(ymd: string): string {
  return ymd.slice(0, 7);
}

/* ───────────────────────── 스트릭 ───────────────────────── */

export interface StreakInput {
  /** 연속 출근 일수 */
  streak: number;
  /** 마지막 출근 날짜 'YYYY-MM-DD' */
  lastPlayDate: string | null;
  /** 이번 달 남은 유급휴가 */
  leavesLeft: number;
  /** leavesLeft 가 적용되는 달 'YYYY-MM' */
  leaveMonth: string;
}

/**
 * 오늘 출근 처리 후의 스트릭.
 * - 같은 날 → 변화 없음
 * - 어제 출근 → +1
 * - 정확히 하루 빠졌고 유급휴가가 남아 있으면 → 휴가 1 소비, +1
 * - 그 외(이틀 이상 빠짐, 휴가 없음, 첫 출근) → 1 로 리셋
 * 달이 바뀌었으면 먼저 leavesLeft 를 LEAVES_PER_MONTH 로 되돌린다.
 */
export function updateStreak(input: StreakInput, today: string): StreakInput {
  const thisMonth = monthOf(today);
  let leavesLeft = input.leavesLeft;
  if (input.leaveMonth !== thisMonth) leavesLeft = LEAVES_PER_MONTH;

  const base: StreakInput = { ...input, leavesLeft, leaveMonth: thisMonth };

  if (input.lastPlayDate === null) {
    return { ...base, streak: 1, lastPlayDate: today };
  }
  const gap = dayDiff(input.lastPlayDate, today);
  if (gap <= 0) {
    // 같은 날(또는 시계가 뒤로 간 경우) — 스트릭은 그대로
    return base;
  }
  if (gap === 1) {
    return { ...base, streak: input.streak + 1, lastPlayDate: today };
  }
  if (gap === 2 && leavesLeft > 0) {
    return {
      ...base,
      streak: input.streak + 1,
      lastPlayDate: today,
      leavesLeft: leavesLeft - 1,
    };
  }
  return { ...base, streak: 1, lastPlayDate: today };
}

/* ───────────────────────── 레귤러 ───────────────────────── */

/** 호감도 최대 */
export const AFFINITY_MAX = 5;

/**
 * 레귤러를 만났을 때의 상태 갱신.
 * 호감도는 하루 최대 1 오르고(최대 5), 만난 횟수와 마지막 만난 날짜는 항상 갱신된다.
 */
export function bumpAffinity(state: RegularState, today: string): RegularState {
  const alreadyToday = state.lastMetDate === today;
  return {
    ...state,
    affinity: alreadyToday ? state.affinity : Math.min(AFFINITY_MAX, state.affinity + 1),
    metCount: state.metCount + 1,
    lastMetDate: today,
  };
}

export interface UnlockContext {
  rank: RankId;
  slot: ShiftSlot;
  /** 1~12 */
  month: number;
  ranks: RankDef[];
}

/** 직급 ID → 정렬된 직급 목록에서의 인덱스. 없으면 -1 */
function rankIndex(rankId: RankId, ranks: RankDef[]): number {
  return sortedRanks(ranks).findIndex((rank) => rank.id === rankId);
}

/**
 * 이 레귤러가 지금 등장할 수 있는가.
 * open → 항상 / slot → 그 시간대를 플레이 중일 때 / rank → 현재 직급이 요구 직급 이상 / season → 그 달
 */
export function isRegularUnlocked(regular: Regular, ctx: UnlockContext): boolean {
  const unlock = regular.unlock;
  switch (unlock.type) {
    case "open":
      return true;
    case "slot":
      return ctx.slot === unlock.slot;
    case "rank": {
      const have = rankIndex(ctx.rank, ctx.ranks);
      const need = rankIndex(unlock.rank, ctx.ranks);
      if (have < 0 || need < 0) return false;
      return have >= need;
    }
    case "season":
      return ctx.month === unlock.month;
  }
}

/* ───────────────────────── 시프트 슬롯 ───────────────────────── */

/** today 의 날짜가 오늘이 아니면 완료 목록은 비어 있는 것으로 본다 */
function completedToday(today: TodayProgress, todayYmd: string): ShiftSlot[] {
  return today.date === todayYmd ? today.completed : [];
}

/**
 * 지금 들어갈 수 있는 시프트.
 * asa 는 항상, hiru 는 asa 완료 후, yoru 는 hiru 완료 후 열린다. 완료한 슬롯도 목록에 남는다(재플레이 허용).
 */
export function availableShiftSlots(today: TodayProgress, todayYmd: string): ShiftSlot[] {
  const done = completedToday(today, todayYmd);
  const out: ShiftSlot[] = ["asa"];
  if (done.includes("asa")) out.push("hiru");
  if (done.includes("hiru")) out.push("yoru");
  return out;
}

/** 아직 완료하지 않은 첫 시프트. 셋 다 끝났으면 null */
export function nextShiftSlot(today: TodayProgress, todayYmd: string): ShiftSlot | null {
  const done = completedToday(today, todayYmd);
  for (const slot of SHIFT_SLOTS) {
    if (!done.includes(slot)) return slot;
  }
  return null;
}
