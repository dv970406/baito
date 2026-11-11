/**
 * 시프트 상태머신 — 순수 리듀서.
 * UI 는 매 프레임 TICK 을, 버튼은 ANSWER 를 보내고, 상태만 그린다.
 *
 * 난수 처리: 상태에 RNG 객체를 두지 않는다. 필요한 순간마다
 *   createRng(hashSeed(seed, <용도>, customerIndex, stepIndex, attempt…))
 * 로 파생한다. 같은 seed 와 같은 답 순서는 TICK 간격이 달라도 같은 손님·선택지·말풍선을 만든다
 * (리플레이·테스트·서버 검증 가능).
 */
import { resolveCart } from "./cartResolver";
import { tagSetKey } from "./cartResolver";
import { buildOptions, findCorrectPhrase } from "./distractor";
import { computeWageDelta, WAGE_FLOOR } from "./progression";
import { createRng, hashSeed } from "./rng";
import { applyAnswerToWeights, effectiveActiveTags, generateCustomer } from "./scheduler";
import { gradeSpeed } from "./scoring";
import { QUESTION_TAG } from "./types";
import type {
  AnswerLog,
  CustomerReply,
  CustomerSpec,
  HardestPhrase,
  ItemTag,
  QuestionKind,
  QuestionStep,
  Regular,
  ShiftConfig,
  ShiftEvent,
  ShiftState,
  ShiftSummary,
  TagWeights,
  WorkplaceId,
  WorkplaceContent,
} from "./types";
import type { Rng } from "./rng";

/** 각 단계의 연출 길이(ms) */
export const TIMING = {
  ENTER_MS: 900,
  REPLY_MS: 1300,
  CONFUSED_MS: 1200,
  HINT_MS: 1600,
  LEAVE_MS: 900,
} as const;

/** 연속 이탈 이 수에 도달하면 점장 호출로 강제 종료 */
export const MANAGER_CALL_MISSES = 3;

/** 직전 몇 명의 태그 집합과 중복을 피할지 */
const RECENT_TAGSET_WINDOW = 3;

/** 손님 응답 후보가 비어 있을 때의 대체 말풍선 */
const SILENT_REPLY: CustomerReply = { ja: "…", ko: "…" };

export interface CreateShiftOptions {
  content: WorkplaceContent;
  config: ShiftConfig;
  seed: number;
  tagWeights: TagWeights;
  /** 해금 조건을 이미 통과한 레귤러들 (isRegularUnlocked 로 걸러서 넘긴다) */
  regularsAvailable: Regular[];
  unlockedTags: ItemTag[];
}

/**
 * 시프트 초기 상태.
 * 손님은 아직 없다 — phase 는 'enter' 이지만 customer 가 null 이고 phaseRemainingMs 는 0, started 는 false.
 * START 이벤트를 보내야 손님 0 이 생성되며 실제 'enter' 연출이 시작된다. 그 전의 TICK/ANSWER 는 무시된다.
 */
export function createShift(opts: CreateShiftOptions): ShiftState {
  return {
    config: opts.config,
    seed: opts.seed,
    started: false,
    activeTags: effectiveActiveTags(opts.config, opts.unlockedTags),
    regularPool: opts.regularsAvailable.map((regular) => regular.id),
    elapsedMs: 0,
    phase: "enter",
    customerIndex: 0,
    customer: null,
    queue: [],
    stepIndex: 0,
    options: [],
    questionStartedAt: 0,
    wrongOnStep: 0,
    irritation: 0,
    mood: "neutral",
    bubble: null,
    phaseRemainingMs: 0,
    afterReply: "advance",
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    goods: 0,
    oks: 0,
    lates: 0,
    wrongs: 0,
    served: 0,
    missed: 0,
    consecutiveMissed: 0,
    log: [],
    tagWeights: { ...opts.tagWeights },
    recentTagSets: [],
    regularsMet: [],
    pendingRetryTags: [],
    endedBy: null,
  };
}

/* ───────────────────────── 난수 파생 ───────────────────────── */

function customerRng(state: ShiftState, index: number): Rng {
  return createRng(hashSeed(state.seed, "customer", index));
}

function optionsRng(state: ShiftState): Rng {
  return createRng(hashSeed(state.seed, "options", state.customerIndex, state.stepIndex));
}

function replyRng(state: ShiftState, attempt: number): Rng {
  return createRng(hashSeed(state.seed, "reply", state.customerIndex, state.stepIndex, attempt));
}

function pickReply(replies: CustomerReply[] | undefined, rng: Rng): CustomerReply {
  return replies && replies.length > 0 ? rng.pick(replies) : SILENT_REPLY;
}

/* ───────────────────────── 손님 생성 ───────────────────────── */

/**
 * index 번째 손님을 생성해 'enter' 로 들어간다.
 * 질문 큐는 resolveCart 결과 중 이 레벨에 정답 문구가 있는 종류만 남긴다.
 */
function spawnCustomer(state: ShiftState, index: number, content: WorkplaceContent): ShiftState {
  const rng = customerRng(state, index);
  const regularsAvailable = state.regularPool
    .map((id) => content.regulars.find((regular) => regular.id === id))
    .filter((regular): regular is Regular => regular !== undefined);

  const customer = generateCustomer({
    content,
    config: state.config,
    index,
    rng,
    tagWeights: state.tagWeights,
    recentTagSets: state.recentTagSets,
    pendingRetryTags: state.pendingRetryTags,
    regularsAvailable,
    regularsAlreadyMet: state.regularsMet,
    activeTags: state.activeTags,
  });

  const pointCard = rng.chance(state.config.pointCardChance);
  const kinds = resolveCart(customer.items, {
    level: state.config.level,
    activeTags: state.activeTags,
    pointCard,
  });
  const queue: QuestionStep[] = [];
  for (const kind of kinds) {
    const phrase = findCorrectPhrase(kind, customer, content, state.config.level);
    if (phrase) queue.push({ kind, correctPhraseId: phrase.id });
  }

  return {
    ...state,
    phase: "enter",
    phaseRemainingMs: TIMING.ENTER_MS,
    customerIndex: index,
    customer,
    queue,
    stepIndex: 0,
    options: [],
    questionStartedAt: state.elapsedMs,
    wrongOnStep: 0,
    irritation: 0,
    mood: "neutral",
    bubble: null,
    afterReply: "advance",
    recentTagSets: [...state.recentTagSets, tagSetKey(customer.tagSet)].slice(-RECENT_TAGSET_WINDOW),
    regularsMet: customer.regularId ? [...state.regularsMet, customer.regularId] : state.regularsMet,
  };
}

/* ───────────────────────── 단계 전이 ───────────────────────── */

/** 현재 stepIndex 의 질문을 띄운다 (선택지 생성). 큐가 비었으면 손님 처리 완료로 간다 */
function openQuestion(state: ShiftState, content: WorkplaceContent): ShiftState {
  const customer = state.customer;
  if (!customer || state.queue.length === 0) return completeCustomer(state);
  const step = state.queue[state.stepIndex];
  const options = buildOptions(step, {
    content,
    customer,
    queue: state.queue.map((s) => s.kind),
    level: state.config.level,
    rng: optionsRng(state),
  });
  return {
    ...state,
    phase: "question",
    options,
    questionStartedAt: state.elapsedMs,
    wrongOnStep: 0,
    mood: "neutral",
    bubble: null,
    phaseRemainingMs: 0,
  };
}

/** 같은 질문 재시도: 선택지는 그대로, 타이머만 새로 시작. 표정은 유지(짜증난 손님은 계속 짜증나 있다) */
function reopenQuestion(state: ShiftState): ShiftState {
  return {
    ...state,
    phase: "question",
    questionStartedAt: state.elapsedMs,
    bubble: null,
    phaseRemainingMs: 0,
  };
}

/** 손님의 모든 질문을 끝냈다 → 결제 완료, 만족 퇴장 */
function completeCustomer(state: ShiftState): ShiftState {
  return {
    ...state,
    phase: "leave",
    phaseRemainingMs: TIMING.LEAVE_MS,
    served: state.served + 1,
    consecutiveMissed: 0,
    mood: "happy",
    bubble: null,
    options: [],
  };
}

/** 'enter' 가 끝났다 */
function onEnterEnd(state: ShiftState, content: WorkplaceContent): ShiftState {
  return openQuestion(state, content);
}

/** 'reply' 가 끝났다: 재시도 / 다음 질문 / 손님 완료 */
function onReplyEnd(state: ShiftState, content: WorkplaceContent): ShiftState {
  if (state.afterReply === "retry") return reopenQuestion(state);
  if (state.stepIndex + 1 < state.queue.length) {
    return openQuestion({ ...state, stepIndex: state.stepIndex + 1 }, content);
  }
  return completeCustomer(state);
}

/** 시프트가 끝나야 하는가 */
function resolveEnd(state: ShiftState): ShiftState["endedBy"] {
  if (state.consecutiveMissed >= MANAGER_CALL_MISSES) return "manager";
  if (state.elapsedMs >= state.config.durationSec * 1000) return "time";
  if (state.customerIndex + 1 >= state.config.customerCount) return "customers";
  return null;
}

/** 'leave' 가 끝났다: 종료 판정 또는 다음 손님 */
function onLeaveEnd(state: ShiftState, content: WorkplaceContent): ShiftState {
  const endedBy = resolveEnd(state);
  if (endedBy) {
    return { ...state, phase: "done", endedBy, phaseRemainingMs: 0, bubble: null, options: [] };
  }
  return spawnCustomer(state, state.customerIndex + 1, content);
}

/** 연출 단계(enter/reply/leave)가 끝났을 때의 전이 */
function finishTimedPhase(state: ShiftState, content: WorkplaceContent): ShiftState {
  switch (state.phase) {
    case "enter":
      return onEnterEnd(state, content);
    case "reply":
      return onReplyEnd(state, content);
    case "leave":
      return onLeaveEnd(state, content);
    default:
      return state;
  }
}

/* ───────────────────────── 답변 처리 ───────────────────────── */

function currentStep(state: ShiftState): QuestionStep | undefined {
  return state.queue[state.stepIndex];
}

function pushUnique(tags: ItemTag[], tag: ItemTag | undefined): ItemTag[] {
  if (tag === undefined || tags.includes(tag)) return tags;
  return [...tags, tag];
}

function applyCorrect(state: ShiftState, step: QuestionStep, chosenPhraseId: string, content: WorkplaceContent): ShiftState {
  const reactionMs = state.elapsedMs - state.questionStartedAt;
  const grade = gradeSpeed(reactionMs, state.config.questionTimeSec * 1000);
  const attempt = state.wrongOnStep + 1;
  const tag = QUESTION_TAG[step.kind];
  const combo = state.combo + 1;

  const entry: AnswerLog = {
    customerIndex: state.customerIndex,
    kind: step.kind,
    correctPhraseId: step.correctPhraseId,
    chosenPhraseId,
    correct: true,
    grade,
    reactionMs,
    timedOut: false,
    attempt,
  };

  return {
    ...state,
    perfects: state.perfects + (grade === "perfect" ? 1 : 0),
    goods: state.goods + (grade === "good" ? 1 : 0),
    oks: state.oks + (grade === "ok" ? 1 : 0),
    lates: state.lates + (grade === "late" ? 1 : 0),
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    log: [...state.log, entry],
    tagWeights: applyAnswerToWeights(state.tagWeights, tag, grade === "perfect" ? "perfect" : "correct"),
    pendingRetryTags: tag ? state.pendingRetryTags.filter((t) => t !== tag) : state.pendingRetryTags,
    phase: "reply",
    phaseRemainingMs: TIMING.REPLY_MS,
    mood: "happy",
    bubble: pickReply(content.replies[step.kind], replyRng(state, attempt)),
    afterReply: "advance",
  };
}

/**
 * 오답(또는 시간 초과) 처리.
 * 1번째 오답: 손님이 당황(「へ？」) → 같은 질문 재시도.
 * 2번째부터: 짜증 게이지 +1. 가득 차면 물건을 두고 나간다(남은 질문은 기록 없이 포기). 아니면 손님이 직접 요구를 말해준다(힌트) → 재시도.
 */
function applyWrong(
  state: ShiftState,
  step: QuestionStep,
  chosenPhraseId: string | null,
  timedOut: boolean,
  content: WorkplaceContent,
): ShiftState {
  const customer = state.customer;
  if (!customer) return state;
  const reactionMs = state.elapsedMs - state.questionStartedAt;
  const attempt = state.wrongOnStep + 1;
  const tag = QUESTION_TAG[step.kind];
  const rng = replyRng(state, attempt);

  const entry: AnswerLog = {
    customerIndex: state.customerIndex,
    kind: step.kind,
    correctPhraseId: step.correctPhraseId,
    chosenPhraseId,
    correct: false,
    grade: null,
    reactionMs,
    timedOut,
    attempt,
  };

  const base: ShiftState = {
    ...state,
    wrongs: state.wrongs + 1,
    combo: 0,
    wrongOnStep: attempt,
    log: [...state.log, entry],
    tagWeights: applyAnswerToWeights(state.tagWeights, tag, "wrong"),
    pendingRetryTags: pushUnique(state.pendingRetryTags, tag),
  };

  if (attempt === 1) {
    return {
      ...base,
      mood: "confused",
      bubble: pickReply(content.confusedReplies, rng),
      phase: "reply",
      phaseRemainingMs: TIMING.CONFUSED_MS,
      afterReply: "retry",
    };
  }

  const irritation = state.irritation + 1;
  if (irritation >= customer.patienceMax) {
    return {
      ...base,
      irritation,
      missed: state.missed + 1,
      consecutiveMissed: state.consecutiveMissed + 1,
      mood: "gone",
      bubble: pickReply(content.leaveReplies, rng),
      phase: "leave",
      phaseRemainingMs: TIMING.LEAVE_MS,
      afterReply: "advance",
      options: [],
    };
  }

  return {
    ...base,
    irritation,
    mood: "annoyed",
    bubble: content.hints[step.kind] ?? pickReply(content.confusedReplies, rng),
    phase: "reply",
    phaseRemainingMs: TIMING.HINT_MS,
    afterReply: "retry",
  };
}

/* ───────────────────────── 이벤트 ───────────────────────── */

function onStart(state: ShiftState, content: WorkplaceContent): ShiftState {
  if (state.started) return state;
  return spawnCustomer({ ...state, started: true, elapsedMs: 0 }, 0, content);
}

function onTick(state: ShiftState, dtMs: number, content: WorkplaceContent): ShiftState {
  if (!state.started || state.phase === "done" || dtMs <= 0) return state;
  const elapsedMs = state.elapsedMs + dtMs;

  if (state.phase === "question") {
    const next = { ...state, elapsedMs };
    const step = currentStep(state);
    if (step && elapsedMs - state.questionStartedAt >= state.config.questionTimeSec * 1000) {
      return applyWrong(next, step, null, true, content);
    }
    return next;
  }

  const phaseRemainingMs = state.phaseRemainingMs - dtMs;
  const next = { ...state, elapsedMs, phaseRemainingMs };
  if (phaseRemainingMs <= 0) return finishTimedPhase(next, content);
  return next;
}

function onAnswer(state: ShiftState, phraseId: string, content: WorkplaceContent): ShiftState {
  if (!state.started || state.phase !== "question") return state;
  const step = currentStep(state);
  if (!step) return state;
  if (phraseId === step.correctPhraseId) return applyCorrect(state, step, phraseId, content);
  return applyWrong(state, step, phraseId, false, content);
}

function onSkipPhase(state: ShiftState, content: WorkplaceContent): ShiftState {
  if (!state.started) return state;
  if (state.phase !== "enter" && state.phase !== "reply" && state.phase !== "leave") return state;
  return finishTimedPhase({ ...state, phaseRemainingMs: 0 }, content);
}

/** 순수 리듀서. 항상 새 객체를 돌려준다(변화가 없을 때는 같은 참조를 돌려줄 수 있다) */
export function shiftReducer(state: ShiftState, event: ShiftEvent, content: WorkplaceContent): ShiftState {
  switch (event.type) {
    case "START":
      return onStart(state, content);
    case "TICK":
      return onTick(state, event.dtMs, content);
    case "ANSWER":
      return onAnswer(state, event.phraseId, content);
    case "SKIP_PHASE":
      return onSkipPhase(state, content);
  }
}

/* ───────────────────────── 파생 값 ───────────────────────── */

/** 현재 질문의 남은 시간(ms). question 단계가 아니면 0 */
export function questionRemainingMs(state: ShiftState): number {
  if (state.phase !== "question") return 0;
  const limit = state.config.questionTimeSec * 1000;
  return Math.max(0, limit - (state.elapsedMs - state.questionStartedAt));
}

/** 시프트 진행도 0~1 = 처리한(응대+이탈) 손님 / 전체 손님 수 */
export function shiftProgress(state: ShiftState): number {
  if (state.config.customerCount <= 0) return 1;
  return Math.min(1, (state.served + state.missed) / state.config.customerCount);
}

/* ───────────────────────── 요약 ───────────────────────── */

export interface SummarizeContext {
  workplaceId: WorkplaceId;
  wageBefore: number;
  /** 이 시프트 전까지 Perfect 를 낸 적 있는 태그 */
  perfectedTags: ItemTag[];
  /** ISO 날짜시간 */
  playedAt: string;
}

/** 가장 많이 헷갈린 문구: (kind, 정답 id) 별 오답+Late 수가 최다인 것. 동률은 먼저 나온 것. 없으면 null */
export function hardestPhrase(log: AnswerLog[]): HardestPhrase | null {
  const stats = new Map<string, HardestPhrase>();
  const order: string[] = [];
  for (const entry of log) {
    const key = `${entry.kind}::${entry.correctPhraseId}`;
    let stat = stats.get(key);
    if (!stat) {
      stat = { phraseId: entry.correctPhraseId, kind: entry.kind, wrongCount: 0, lateCount: 0 };
      stats.set(key, stat);
      order.push(key);
    }
    if (!entry.correct) stat.wrongCount += 1;
    else if (entry.grade === "late") stat.lateCount += 1;
  }
  let best: HardestPhrase | null = null;
  for (const key of order) {
    const stat = stats.get(key);
    if (!stat) continue;
    const score = stat.wrongCount + stat.lateCount;
    if (score === 0) continue;
    if (!best || score > best.wrongCount + best.lateCount) best = stat;
  }
  return best;
}

/** 이 시프트에서 처음으로 Perfect 를 낸 태그 (기존 perfectedTags 에 없는 것) */
export function firstSuccessTagsOf(log: AnswerLog[], perfectedTags: ItemTag[]): ItemTag[] {
  const out: ItemTag[] = [];
  for (const entry of log) {
    if (entry.grade !== "perfect") continue;
    const tag = QUESTION_TAG[entry.kind];
    if (tag && !perfectedTags.includes(tag) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** 시프트 종료 요약 = 마감 영수증의 원본 */
export function summarize(state: ShiftState, ctx: SummarizeContext): ShiftSummary {
  const firstSuccessTags = firstSuccessTagsOf(state.log, ctx.perfectedTags);
  const wageDelta = computeWageDelta({
    perfects: state.perfects,
    goods: state.goods,
    oks: state.oks,
    lates: state.lates,
    wrongs: state.wrongs,
    missed: state.missed,
    maxCombo: state.maxCombo,
    firstSuccessTags,
  });
  return {
    workplaceId: ctx.workplaceId,
    slot: state.config.slot,
    level: state.config.level,
    playedAt: ctx.playedAt,
    durationMs: state.elapsedMs,
    served: state.served,
    missed: state.missed,
    questionCount: state.log.length,
    perfects: state.perfects,
    goods: state.goods,
    oks: state.oks,
    lates: state.lates,
    wrongs: state.wrongs,
    maxCombo: state.maxCombo,
    hardest: hardestPhrase(state.log),
    wageDelta,
    wageAfter: Math.max(WAGE_FLOOR, ctx.wageBefore + wageDelta),
    firstSuccessTags,
    regularsMet: state.regularsMet,
    endedBy: state.endedBy ?? "customers",
    answers: state.log,
  };
}

/** 현재 질문 종류 (question/reply 단계에서 UI 가 쓴다). 없으면 null */
export function currentKind(state: ShiftState): QuestionKind | null {
  return currentStep(state)?.kind ?? null;
}

/** 현재 손님(없으면 null) — 타입 좁히기 편의용 */
export function currentCustomer(state: ShiftState): CustomerSpec | null {
  return state.customer;
}
