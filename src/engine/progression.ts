/**
 * 메타 진행: 시급 변동, 승급, 스트릭(연속 출근), 레귤러 호감도, 시프트 슬롯 해금.
 * 모두 순수 함수 — 오늘 날짜는 'YYYY-MM-DD' 문자열 인자로 받는다.
 */
import { LEAVES_PER_MONTH } from "@/shared/player";
import type { RegularState, TodayProgress } from "@/shared/player";
import { DAILY_SLOTS } from "./types";
import type { ExamRule, ItemTag, RankDef, RankId, Regular, ShiftConfig, ShiftSlot, ShiftSummary } from "./types";

/* ───────────────────────── 시급 ───────────────────────── */

export interface WageStats {
  perfects: number;
  goods: number;
  oks: number;
  lates: number;
  wrongs: number;
  missed: number;
  maxCombo: number;
  /** 말하기 모드로 맞힌 수 (없으면 0) */
  spokens?: number;
  firstSuccessTags: ItemTag[];
}

/** 말하기 모드로 맞힌 응대 1회당 추가 시급(¥) — 버튼보다 더 오른다 */
export const SPOKEN_BONUS = 3;

/** 시급 하한(¥) */
export const WAGE_FLOOR = 900;
/** 시프트 1회 시급 변동 범위 */
export const WAGE_DELTA_MIN = -80;
export const WAGE_DELTA_MAX = 160;

/**
 * 시프트 결과 → 시급 변동(¥).
 * perfects×4 + goods×2 + oks×1 + maxCombo×2 + spokens×3 − wrongs×1 − missed×25 + firstSuccessTags×40, [-80, 160] 로 클램프.
 * (late 는 정답이지만 보너스 없음)
 */
export function computeWageDelta(s: WageStats): number {
  const raw =
    s.perfects * 4 +
    s.goods * 2 +
    s.oks * 1 +
    s.maxCombo * 2 +
    (s.spokens ?? 0) * SPOKEN_BONUS -
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
  /** 다음 직급 시험까지 남은 시프트 수 (최고 직급이면 0) */
  shiftsToNext: number;
  /** 현재 직급 구간 안에서의 진행도 0~1 (최고 직급이면 1) */
  progress: number;
  /** 시프트 수를 채워 승급 시험을 볼 수 있는 상태 */
  examReady: boolean;
}

/** shiftsRequired 오름차순으로 정렬된 복사본 */
function sortedRanks(ranks: RankDef[]): RankDef[] {
  return ranks.slice().sort((a, b) => a.shiftsRequired - b.shiftsRequired);
}

/** 직급 ID → 정렬된 직급 목록에서의 인덱스. 없으면 -1 */
export function rankIndex(rankId: RankId, ranks: RankDef[]): number {
  return sortedRanks(ranks).findIndex((rank) => rank.id === rankId);
}

/** a 직급이 b 직급 이상인가 */
export function rankAtLeast(a: RankId, b: RankId, ranks: RankDef[]): boolean {
  const have = rankIndex(a, ranks);
  const need = rankIndex(b, ranks);
  return have >= 0 && need >= 0 && have >= need;
}

/**
 * 누적 시프트 수만으로 유도한 직급 — 시험 제도 이전 세이브(rank 없음)를 변환할 때 쓴다.
 * shiftsRequired 를 채운 가장 높은 직급.
 */
export function rankFor(totalShifts: number, ranks: RankDef[]): RankProgress {
  const sorted = sortedRanks(ranks);
  if (sorted.length === 0) {
    throw new Error("rankFor: 직급 정의가 비어 있다");
  }
  let currentIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (totalShifts >= sorted[i].shiftsRequired) currentIdx = i;
  }
  return rankOf(sorted[currentIdx].id, totalShifts, ranks);
}

/**
 * 현재 직급(명시)과 누적 시프트 수 → 다음 직급까지의 진행도.
 * 승급은 시프트 수가 아니라 승급 시험(점장 점검 시프트) 합격으로만 일어난다.
 * 시프트 수를 채우면 examReady, 시험에 붙으면 profile.rank 가 올라간다.
 */
export function rankOf(rankId: RankId, totalShifts: number, ranks: RankDef[]): RankProgress {
  const sorted = sortedRanks(ranks);
  if (sorted.length === 0) {
    throw new Error("rankOf: 직급 정의가 비어 있다");
  }
  const idx = Math.max(0, sorted.findIndex((rank) => rank.id === rankId));
  const current = sorted[idx];
  const next = idx + 1 < sorted.length ? sorted[idx + 1] : null;
  if (!next) {
    return { current, next: null, shiftsToNext: 0, progress: 1, examReady: false };
  }
  const span = Math.max(1, next.shiftsRequired - current.shiftsRequired);
  const done = Math.max(0, totalShifts - current.shiftsRequired);
  return {
    current,
    next,
    shiftsToNext: Math.max(0, next.shiftsRequired - totalShifts),
    progress: Math.min(1, done / span),
    examReady: totalShifts >= next.shiftsRequired,
  };
}

/** 현재 직급까지 도달한 모든 직급의 unlocksTags 합집합 */
export function unlockedTags(rankId: RankId, ranks: RankDef[]): ItemTag[] {
  const sorted = sortedRanks(ranks);
  const idx = sorted.findIndex((rank) => rank.id === rankId);
  const set = new Set<ItemTag>();
  for (let i = 0; i <= idx; i++) {
    for (const tag of sorted[i].unlocksTags) set.add(tag);
  }
  return Array.from(set);
}

/* ───────────────────────── 승급 시험 ───────────────────────── */

export interface ExamInput {
  rank: RankId;
  totalShifts: number;
  /** 마지막으로 시험을 본 주(월요일 YYYY-MM-DD). 같은 주에는 다시 볼 수 없다 */
  examWeek: string | null;
}

export interface ExamAvailability {
  /** 시험으로 올라갈 다음 직급. 최고 직급이면 null */
  target: RankDef | null;
  rule: ExamRule | null;
  /** 시프트 수를 채웠는가 */
  ready: boolean;
  /** 이번 주에 이미 봤는가 */
  takenThisWeek: boolean;
  /** 지금 볼 수 있는가 */
  available: boolean;
}

/** 승급 시험을 볼 수 있는지 — 다음 직급의 shiftsRequired 를 채웠고, 이번 주에 아직 안 봤을 때 */
export function examAvailability(input: ExamInput, ranks: RankDef[], weekStart: string): ExamAvailability {
  const progress = rankOf(input.rank, input.totalShifts, ranks);
  const target = progress.next;
  const rule = target?.exam ?? null;
  const ready = Boolean(target && rule && progress.examReady);
  const takenThisWeek = input.examWeek === weekStart;
  return { target, rule, ready, takenThisWeek, available: ready && !takenThisWeek };
}

/** 시험 합격 판정 — 최고 콤보가 기준 이상이고 이탈 0 */
export function examPassed(summary: Pick<ShiftSummary, "maxCombo" | "missed">, rule: ExamRule): boolean {
  return summary.maxCombo >= rule.combo && summary.missed === 0;
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

/** 'YYYY-MM-DD' 가 속한 주의 월요일 'YYYY-MM-DD' (승급 시험·리그의 주 단위) */
export function weekStartOf(ymd: string): string {
  const days = ymdToDays(ymd);
  // 1970-01-01 은 목요일(4). 월=0 … 일=6
  const dow = (days + 3) % 7;
  const monday = days - ((dow % 7) + 7) % 7;
  const d = new Date(monday * 86_400_000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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

export interface SlotContext {
  /** 현재 직급 — requiredRank 가 있는 추가 시프트(심야) 판정 */
  rank?: RankId;
  ranks?: RankDef[];
  shifts?: Record<ShiftSlot, ShiftConfig>;
}

/** 추가 시프트(심야)가 직급상 열려 있는가 */
export function isOptionalSlotUnlocked(config: ShiftConfig, ctx: SlotContext): boolean {
  if (!config.requiredRank) return true;
  if (!ctx.rank || !ctx.ranks) return false;
  return rankAtLeast(ctx.rank, config.requiredRank, ctx.ranks);
}

/**
 * 지금 들어갈 수 있는 시프트.
 * asa 는 항상, hiru 는 asa 완료 후, yoru 는 hiru 완료 후 열린다. 완료한 슬롯도 목록에 남는다(재플레이 허용).
 * 추가 시프트(optional, 심야)는 기본 3개를 다 끝내고 직급 조건을 채웠을 때 열린다.
 */
export function availableShiftSlots(today: TodayProgress, todayYmd: string, ctx: SlotContext = {}): ShiftSlot[] {
  const done = completedToday(today, todayYmd);
  const out: ShiftSlot[] = ["asa"];
  if (done.includes("asa")) out.push("hiru");
  if (done.includes("hiru")) out.push("yoru");
  if (ctx.shifts && DAILY_SLOTS.every((slot) => done.includes(slot))) {
    for (const config of Object.values(ctx.shifts)) {
      if (config.optional && isOptionalSlotUnlocked(config, ctx)) out.push(config.slot);
    }
  }
  return out;
}

/** 아직 완료하지 않은 첫 기본 시프트. 셋 다 끝났으면 null (추가 시프트는 세지 않는다) */
export function nextShiftSlot(today: TodayProgress, todayYmd: string): ShiftSlot | null {
  const done = completedToday(today, todayYmd);
  for (const slot of DAILY_SLOTS) {
    if (!done.includes(slot)) return slot;
  }
  return null;
}
