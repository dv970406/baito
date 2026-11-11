/**
 * BAITO 엔진 공통 타입.
 * 원칙: "코드는 엔진, 게임은 데이터". 엔진은 직장(workplace) 이름을 모르고,
 * 이 파일의 타입으로 기술된 콘텐츠만 입력으로 받는다.
 */

/** 직장 ID. 데이터 폴더 이름과 같다. */
export type WorkplaceId = "konbini" | "hoteru" | "shokudo" | "kuko";

/** 시프트 시간대: 朝(asa) · 昼(hiru) · 夕(yoru) */
export type ShiftSlot = "asa" | "hiru" | "yoru";
export const SHIFT_SLOTS: readonly ShiftSlot[] = ["asa", "hiru", "yoru"];

/** 상품 태그 — 질문 큐를 발생시키는 엔진의 입력. (bag 은 상품 2개 이상에서 파생되므로 태그가 아니다) */
export type ItemTag =
  | "hot"
  | "cold"
  | "chopsticks"
  | "spoon"
  | "straw"
  | "alcohol"
  | "tobacco"
  | "fragile_hot";
export const ITEM_TAGS: readonly ItemTag[] = [
  "hot",
  "cold",
  "chopsticks",
  "spoon",
  "straw",
  "alcohol",
  "tobacco",
  "fragile_hot",
];

/** 질문 종류 = 접객 흐름의 한 단계. 실제 일본 편의점 접객 순서대로 정렬된다. */
export type QuestionKind =
  | "AGE_CHECK"
  | "POINT_CARD"
  | "WARM"
  | "SEPARATE_BAG"
  | "BAG"
  | "CHOPSTICKS"
  | "SPOON"
  | "STRAW"
  | "TOTAL"
  | "PAY"
  | "CAUTION_HOT";

/** 접객 순서: 연령확인 → 포인트카드 → 온도 → 봉투 → 부속품 → 금액 → 결제 → 주의 안내 */
export const QUESTION_ORDER: readonly QuestionKind[] = [
  "AGE_CHECK",
  "POINT_CARD",
  "WARM",
  "SEPARATE_BAG",
  "BAG",
  "CHOPSTICKS",
  "SPOON",
  "STRAW",
  "TOTAL",
  "PAY",
  "CAUTION_HOT",
];

/** 질문 종류 → 그 질문을 발생시키는 태그. (BAG/TOTAL/PAY/POINT_CARD 는 태그가 아닌 규칙으로 발생) */
export const QUESTION_TAG: Partial<Record<QuestionKind, ItemTag>> = {
  AGE_CHECK: "alcohol", // tobacco 도 함께 — resolver 가 처리
  WARM: "hot",
  SEPARATE_BAG: "hot", // hot + cold 동시
  CHOPSTICKS: "chopsticks",
  SPOON: "spoon",
  STRAW: "straw",
  CAUTION_HOT: "fragile_hot",
};

export type PaymentMethod = "cash" | "ic" | "qr" | "credit";
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "ic", "qr", "credit"];

/** 근접 오답(같은 카테고리의 다른 문구) 생성용 분류 */
export type PhraseCategory =
  | "age"
  | "point"
  | "temperature"
  | "bag"
  | "utensil"
  | "amount"
  | "payment"
  | "caution"
  | "greeting"
  | "service";

/**
 * 접객 문구.
 * - kind 가 있으면 그 질문의 정답. PAY 는 payment 별로 정답이 하나씩.
 * - kind 가 null 이면 오답 전용 문구(존재하지 않는 서비스, 다른 타이밍의 인사 등).
 */
export interface Phrase {
  id: string;
  kind: QuestionKind | null;
  payment?: PaymentMethod;
  category: PhraseCategory;
  /** 일본어 본문. TOTAL 문구는 "{total}" 플레이스홀더를 가진다. */
  ja: string;
  /** 한국어 번역(항상 부제로, 작게) */
  ko: string;
  /** 히라가나 읽기(선택) */
  reading?: string;
  /** 등장 최소 레벨 (1~4) */
  level: number;
  /**
   * 흐름상 위치. 타이밍 오답("지금 단계가 아닌 문구") 생성에 쓴다.
   * 정답 문구는 kind 가 곧 위치이므로 생략 가능. 오답 전용은 반드시 명시.
   */
  stage?: QuestionKind | "GREETING" | "THANKS";
}

export type ItemShape =
  | "bento"
  | "onigiri"
  | "can"
  | "bottle"
  | "cup"
  | "pack"
  | "box"
  | "tray"
  | "stick"
  | "bar";

export interface ItemVisual {
  shape: ItemShape;
  /** 메인 색(hex). 씬 전용 색이라 hex 허용 */
  color: string;
  /** 보조 색(hex) */
  accent?: string;
}

export interface Item {
  id: string;
  ja: string;
  ko: string;
  /** 엔(¥) */
  price: number;
  tags: ItemTag[];
  /** 등장 최소 레벨 */
  level: number;
  visual: ItemVisual;
}

/** 손님의 짧은 응답(「お願いします」「大丈夫です」 등) */
export interface CustomerReply {
  ja: string;
  ko: string;
}

/** 레귤러 호감도 단계별 대사 */
export interface RegularLine {
  /** 이 대사가 열리는 호감도(1~5) */
  affinity: number;
  ja: string;
  ko: string;
}

export type RankId = "shinjin" | "ippan" | "senpai" | "leader" | "fukutencho" | "tencho";

export type RegularUnlock =
  | { type: "open" }
  | { type: "slot"; slot: ShiftSlot; label: string }
  | { type: "rank"; rank: RankId; label: string }
  | { type: "season"; month: number; label: string };

export type HairStyle = "short" | "long" | "cap" | "bald" | "bun" | "ponytail" | "mohawk" | "hat";

export interface RegularVisual {
  skin: string;
  hairColor: string;
  hairStyle: HairStyle;
  outfit: string;
  /** 넥타이·앞치마 등 포인트 색 */
  accent?: string;
}

/** 고정 손님(레귤러). 서사와 호감도를 가진다. */
export interface Regular {
  id: string;
  nameJa: string;
  nameKo: string;
  /** 샐러리맨, 간호사 … */
  role: string;
  /** 등장 시간대 */
  slots: ShiftSlot[];
  /** 고정 구매 패턴(item id). 빈 배열이면 매번 무작위 */
  purchase: string[];
  payment: PaymentMethod;
  /** 말버릇 한 줄 (ja) */
  tic: string;
  ticKo: string;
  /** 호감도 단계별 대사 (최대 5줄) */
  lines: RegularLine[];
  /** "처음 들은 말"로 수집되는 짧은 대사들 */
  firstWords: CustomerReply[];
  unlock: RegularUnlock;
  visual: RegularVisual;
  /** 호감도와 무관하게 기본 인내심 보정 (0 = 기본) */
  patienceBonus?: number;
}

export type ManagerMoment = "home" | "shift_end_good" | "shift_end_mid" | "shift_end_bad" | "absent";

export interface ManagerLine {
  when: ManagerMoment;
  /** 특정 시간대 전용이면 지정 */
  slot?: ShiftSlot;
  ja: string;
  ko: string;
}

export interface RankDef {
  id: RankId;
  ja: string;
  ko: string;
  /** 이 직급에 도달하기 위해 완료해야 하는 누적 시프트 수 */
  shiftsRequired: number;
  /** 승급 시 해금되는 태그 */
  unlocksTags: ItemTag[];
}

export interface ShiftConfig {
  slot: ShiftSlot;
  /** 한자 한 글자 배지 (朝/昼/夕) */
  kanji: string;
  nameKo: string;
  /** "07:00–10:00" */
  hours: string;
  level: number;
  /** 시프트 전체 제한 시간(초) */
  durationSec: number;
  /** 손님 수 */
  customerCount: number;
  /** 질문 1개 제한 시간(초) */
  questionTimeSec: number;
  /** 이 시프트에서 등장 가능한 태그 */
  activeTags: ItemTag[];
  /** 포인트카드 질문 발동 확률(0~1) */
  pointCardChance: number;
  /** 손님 1명당 상품 개수 범위 */
  itemsPerCustomer: [number, number];
  /** 홈 화면 한 줄 설명 */
  descriptionKo: string;
}

/** 직장 하나의 콘텐츠 전체 = 데이터 폴더 하나 */
export interface WorkplaceContent {
  id: WorkplaceId;
  /** KONBINI */
  code: string;
  nameJa: string;
  nameKo: string;
  /** マルマート 神田南口店 */
  storeNameJa: string;
  storeBranchJa: string;
  registerLabel: string; // "レジ 02"
  items: Item[];
  phrases: Phrase[];
  regulars: Regular[];
  manager: ManagerLine[];
  ranks: RankDef[];
  shifts: Record<ShiftSlot, ShiftConfig>;
  /** 질문 종류별 손님 응답 후보 */
  replies: Record<QuestionKind, CustomerReply[]>;
  /** 오답 시 손님의 당황 리액션 후보 */
  confusedReplies: CustomerReply[];
  /** 두 번 틀렸을 때 손님이 직접 요구를 말하는 힌트 (kind 별) */
  hints: Partial<Record<QuestionKind, CustomerReply>>;
  /** 손님 이탈 시 대사 */
  leaveReplies: CustomerReply[];
}

/* ───────────────────────── 런타임(시프트 진행) 타입 ───────────────────────── */

export interface QuestionStep {
  kind: QuestionKind;
  correctPhraseId: string;
}

export interface AnswerOption {
  phraseId: string;
  ja: string;
  ko: string;
  isCorrect: boolean;
}

export type SpeedGrade = "perfect" | "good" | "ok" | "late";

export interface AnswerLog {
  customerIndex: number;
  kind: QuestionKind;
  correctPhraseId: string;
  chosenPhraseId: string | null;
  correct: boolean;
  /** 정답일 때만 */
  grade: SpeedGrade | null;
  reactionMs: number;
  timedOut: boolean;
  /** 이 질문에서 몇 번째 시도였는지 (1부터) */
  attempt: number;
}

export interface CustomerSpec {
  index: number;
  regularId: string | null;
  items: Item[];
  payment: PaymentMethod;
  /** 합계 ¥ */
  total: number;
  /** 짜증 게이지 최대 칸 (기본 4) */
  patienceMax: number;
  /** 이 손님의 태그 집합(정렬됨) */
  tagSet: ItemTag[];
}

export type CustomerMood = "neutral" | "happy" | "confused" | "annoyed" | "gone";

export type ShiftPhase =
  /** 손님 등장 애니메이션 */
  | "enter"
  /** 선택지 노출, 타이머 진행 */
  | "question"
  /** 손님 응답 말풍선 */
  | "reply"
  /** 결제 완료, 손님 퇴장 */
  | "leave"
  /** 시프트 종료 */
  | "done";

export type TagWeights = Record<ItemTag, number>;

export interface ShiftState {
  config: ShiftConfig;
  seed: number;
  /** START 이벤트를 받았는가. false 면 phase 'enter' 라도 손님이 없는 대기 상태 */
  started: boolean;
  /** 해금 반영 후 이 시프트에서 실제로 활성인 태그 (effectiveActiveTags) */
  activeTags: ItemTag[];
  /** 이 시프트에 등장 가능한 레귤러 id (content.regulars 에서 조회) */
  regularPool: string[];
  /** 시프트 시작 후 경과(ms) */
  elapsedMs: number;
  phase: ShiftPhase;
  customerIndex: number;
  customer: CustomerSpec | null;
  queue: QuestionStep[];
  stepIndex: number;
  options: AnswerOption[];
  /** 현재 질문이 시작된 elapsedMs */
  questionStartedAt: number;
  /** 현재 질문에서의 오답 횟수 */
  wrongOnStep: number;
  /** 짜증 게이지 (0~patienceMax) */
  irritation: number;
  mood: CustomerMood;
  /** 현재 말풍선 (reply/leave/confused) */
  bubble: CustomerReply | null;
  /** reply/leave/enter 가 끝나기까지 남은 ms */
  phaseRemainingMs: number;
  /** reply 단계가 끝난 뒤 할 일: 다음 질문/손님으로 진행 or 같은 질문 재시도 */
  afterReply: "advance" | "retry";
  combo: number;
  maxCombo: number;
  perfects: number;
  goods: number;
  oks: number;
  lates: number;
  wrongs: number;
  served: number;
  missed: number;
  /** 연속 이탈(3명이면 점장 호출로 강제 종료) */
  consecutiveMissed: number;
  log: AnswerLog[];
  tagWeights: TagWeights;
  /** 직전 손님 3명의 태그 집합(중복 방지) */
  recentTagSets: string[];
  /** 이번 시프트에 등장한 레귤러 */
  regularsMet: string[];
  /** 틀린 뒤 3명 안에 재등장을 보장해야 하는 태그 */
  pendingRetryTags: ItemTag[];
  endedBy: "time" | "customers" | "manager" | null;
}

export type ShiftEvent =
  | { type: "START" }
  | { type: "TICK"; dtMs: number }
  | { type: "ANSWER"; phraseId: string }
  | { type: "SKIP_PHASE" };

export interface HardestPhrase {
  phraseId: string;
  kind: QuestionKind;
  wrongCount: number;
  lateCount: number;
}

/** 시프트 종료 요약 = 마감 영수증의 원본 */
export interface ShiftSummary {
  workplaceId: WorkplaceId;
  slot: ShiftSlot;
  level: number;
  /** ISO 날짜시간 */
  playedAt: string;
  durationMs: number;
  served: number;
  missed: number;
  questionCount: number;
  perfects: number;
  goods: number;
  oks: number;
  lates: number;
  wrongs: number;
  maxCombo: number;
  hardest: HardestPhrase | null;
  /** 이 시프트로 변한 시급(¥) */
  wageDelta: number;
  /** 시프트 후 시급(¥) */
  wageAfter: number;
  /** 처음으로 Perfect 를 낸 태그(보너스) */
  firstSuccessTags: ItemTag[];
  regularsMet: string[];
  endedBy: "time" | "customers" | "manager";
  /** 추후 분석용 */
  answers: AnswerLog[];
}
