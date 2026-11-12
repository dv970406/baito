/**
 * API 요청 본문 zod 스키마. 공유 타입(src/shared, src/engine)을 그대로 미러링한다.
 * 타입이 어긋나면 아래 `satisfies` 단언에서 컴파일이 실패하므로, 계약이 바뀌면 여기도 함께 고친다.
 */
import { z } from "zod";
import { DIRECTIONS, ITEM_TAGS, QUESTION_KINDS, RANK_IDS, SHIFT_SLOTS } from "@/engine/types";
import type { AnswerLog, ExamResult, HardestPhrase, ShiftSummary } from "@/engine/types";
import { normalizeProfile, type PlayerProfile, type RegularState, type TodayProgress } from "@/shared/player";
import type { CreateSessionBody } from "@/shared/api";

/* ───────────────────────── 공통 조각 ───────────────────────── */

const itemTagSchema = z.enum(ITEM_TAGS);
const shiftSlotSchema = z.enum(SHIFT_SLOTS);
const questionKindSchema = z.enum(QUESTION_KINDS);
const rankIdSchema = z.enum(RANK_IDS);
// 길 묻기 방향 — 현재 스키마에서는 쓰지 않지만 계약 일치 확인용으로 유지
void DIRECTIONS;
const workplaceIdSchema = z.enum(["konbini", "hoteru", "shokudo", "kuko"]);
const speedGradeSchema = z.enum(["perfect", "good", "ok", "late"]);

/** YYYY-MM-DD */
const localDateSchema = z.iso.date();
/** YYYY-MM */
const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM 형식이어야 합니다");
/** ISO 날짜시간(오프셋 허용) */
const isoDateTimeSchema = z.iso.datetime({ offset: true });

const nonNegativeInt = z.number().int().min(0);
const count = nonNegativeInt.max(1_000_000);

/* ───────────────────────── PlayerProfile ───────────────────────── */

const regularStateSchema = z
  .object({
    affinity: z.number().min(0).max(5),
    metCount: count,
    lastMetDate: localDateSchema.nullable(),
    firstWordsHeard: z.array(z.string().max(200)).max(500),
  })
  .strict();

const todayProgressSchema = z
  .object({
    date: localDateSchema,
    completed: z.array(shiftSlotSchema).max(SHIFT_SLOTS.length),
  })
  .strict();

/** ItemTag 모두를 키로 갖는 가중치 맵 (예전 세이브는 클라이언트가 normalizeProfile 로 채운 뒤 보낸다) */
const tagWeightsSchema = z.record(itemTagSchema, z.number().finite());

export const playerProfileSchema = z
  .object({
    name: z.string().trim().min(1, "이름은 1자 이상").max(20, "이름은 20자 이하"),
    wage: z.number().int().min(0).max(99_999),
    totalShifts: count,
    // 승급 시험 제도 이전 저장분(rank 없음)은 normalizeProfile 이 누적 시프트 수로 직급을 유도한다
    rank: rankIdSchema.optional(),
    examWeek: localDateSchema.nullable().optional(),
    streak: count,
    lastPlayDate: localDateSchema.nullable(),
    leavesLeft: nonNegativeInt.max(31),
    leaveMonth: yearMonthSchema,
    tagWeights: tagWeightsSchema,
    perfectedTags: z.array(itemTagSchema).max(ITEM_TAGS.length),
    regulars: z.record(z.string().min(1).max(64), regularStateSchema),
    today: todayProgressSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .transform((raw): PlayerProfile => normalizeProfile(raw));

export type PlayerProfileInput = z.infer<typeof playerProfileSchema>;

/* ───────────────────────── ShiftSummary ───────────────────────── */

const answerLogSchema = z
  .object({
    customerIndex: count,
    kind: questionKindSchema,
    correctPhraseId: z.string().max(100),
    chosenPhraseId: z.string().max(100).nullable(),
    correct: z.boolean(),
    grade: speedGradeSchema.nullable(),
    reactionMs: z.number().min(0),
    timedOut: z.boolean(),
    attempt: z.number().int().min(1),
    // 말하기 모드 이전 저장분과 호환되도록 기본값
    spoken: z.boolean().default(false),
  })
  .strict();

const hardestPhraseSchema = z
  .object({
    phraseId: z.string().max(100),
    kind: questionKindSchema,
    wrongCount: count,
    lateCount: count,
  })
  .strict();

const examResultSchema = z
  .object({
    rank: rankIdSchema,
    comboRequired: count,
    passed: z.boolean(),
  })
  .strict();

export const shiftSummarySchema = z
  .object({
    workplaceId: workplaceIdSchema,
    slot: shiftSlotSchema,
    level: z.number().int().min(1).max(10),
    playedAt: isoDateTimeSchema,
    durationMs: z.number().min(0),
    served: count,
    missed: count,
    questionCount: count,
    perfects: count,
    goods: count,
    oks: count,
    lates: count,
    wrongs: count,
    maxCombo: count,
    spokens: count.default(0),
    hardest: hardestPhraseSchema.nullable(),
    wageDelta: z.number().int().min(-99_999).max(99_999),
    wageAfter: z.number().int().min(0).max(99_999),
    firstSuccessTags: z.array(itemTagSchema).max(ITEM_TAGS.length),
    regularsMet: z.array(z.string().max(64)).max(100),
    endedBy: z.enum(["time", "customers", "manager"]),
    exam: examResultSchema.nullable().default(null),
    events: count.default(0),
    /** 추후 분석용 로그 — 폭주 방지를 위해 2000개로 제한 */
    answers: z.array(answerLogSchema).max(2000),
  })
  .strict();

export type ShiftSummaryInput = z.infer<typeof shiftSummarySchema>;

/* ───────────────────────── 요청 본문 ───────────────────────── */

export const createSessionBodySchema = z
  .object({
    summary: shiftSummarySchema,
  })
  .strict();

export type CreateSessionBodyInput = z.infer<typeof createSessionBodySchema>;

/** GET /api/sessions?limit= — 1..50, 기본 10 */
export const sessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/* ───────────────────────── 계약 일치 단언 (컴파일 타임) ───────────────────────── */
/* 스키마 추론 타입과 공유 타입이 양방향으로 대입 가능해야(=동일) 컴파일이 통과한다. */

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type AssertPlayerProfileMatches = Assert<Equals<PlayerProfileInput, PlayerProfile>>;
export type AssertRegularStateMatches = Assert<Equals<z.infer<typeof regularStateSchema>, RegularState>>;
export type AssertTodayProgressMatches = Assert<Equals<z.infer<typeof todayProgressSchema>, TodayProgress>>;
export type AssertShiftSummaryMatches = Assert<Equals<ShiftSummaryInput, ShiftSummary>>;
export type AssertAnswerLogMatches = Assert<Equals<z.infer<typeof answerLogSchema>, AnswerLog>>;
export type AssertHardestPhraseMatches = Assert<Equals<z.infer<typeof hardestPhraseSchema>, HardestPhrase>>;
export type AssertExamResultMatches = Assert<Equals<z.infer<typeof examResultSchema>, ExamResult>>;
export type AssertCreateSessionBodyMatches = Assert<Equals<CreateSessionBodyInput, CreateSessionBody>>;
