/**
 * BAITO 엔진 공통 타입.
 * 원칙: "코드는 엔진, 게임은 데이터". 엔진은 직장(workplace) 이름을 모르고,
 * 이 파일의 타입으로 기술된 콘텐츠만 입력으로 받는다.
 */

/** 직장 ID. 데이터 폴더 이름과 같다. */
export type WorkplaceId = "konbini" | "hoteru" | "shokudo" | "kuko";

/** 시프트 시간대: 朝(asa) · 昼(hiru) · 夕(yoru) · 深夜(shinya, 선배부터 열리는 추가 시프트) */
export type ShiftSlot = "asa" | "hiru" | "yoru" | "shinya";
export const SHIFT_SLOTS: readonly ShiftSlot[] = ["asa", "hiru", "yoru", "shinya"];
/** 하루 기본 시프트 3개 — 셋 다 하면 フルシフト 보너스. 심야는 추가 근무라 여기 들어가지 않는다 */
export const DAILY_SLOTS: readonly ShiftSlot[] = ["asa", "hiru", "yoru"];

/** 상품 태그 — 질문 큐를 발생시키는 엔진의 입력. (bag 은 상품 2개 이상에서 파생되므로 태그가 아니다) */
export type ItemTag =
  | "hot"
  | "cold"
  | "chopsticks"
  | "spoon"
  | "straw"
  | "alcohol"
  | "tobacco"
  | "fragile_hot"
  | "oden"
  | "fried";
export const ITEM_TAGS: readonly ItemTag[] = [
  "hot",
  "cold",
  "chopsticks",
  "spoon",
  "straw",
  "alcohol",
  "tobacco",
  "fragile_hot",
  "oden",
  "fried",
];

/**
 * 질문 종류 = 접객 흐름의 한 단계.
 * - 계산 흐름 질문(QUESTION_ORDER)은 실제 일본 편의점 접객 순서대로 정렬된다.
 * - LISTEN 은 손님이 먼저 요구를 말하고 플레이어가 아이콘으로 반응하는 리스닝 전용 단계(다른 질문 자리를 대신한다).
 * - EVENT_KINDS 는 물건 없이 찾아오는 돌발 손님(길 묻기·택배·화장실 …)의 단일 질문.
 */
export type QuestionKind =
  | "AGE_CHECK"
  | "TOBACCO_NUMBER"
  | "TOBACCO_PICK"
  | "POINT_CARD"
  | "WARM"
  | "SEPARATE_BAG"
  | "BAG"
  | "BAG_SIZE"
  | "CHOPSTICKS"
  | "SPOON"
  | "STRAW"
  | "ODEN_COUNT"
  | "KARASHI"
  | "SAUCE"
  | "TOTAL"
  | "PAY"
  | "RECEIPT_ASK"
  | "CAUTION_HOT"
  | "LISTEN"
  | "DIRECTIONS"
  | "TOILET"
  | "COPIER"
  | "ATM"
  | "DELIVERY"
  | "UTILITY_BILL"
  | "TICKET";

/**
 * 계산 흐름 접객 순서:
 * 연령확인 → 담배 번호 → 포인트카드 → 온도 → 봉투(분리·유무·사이즈) → 부속품 → 오뎅·가라시·소스 → 금액 → 결제 → 영수증 → 주의 안내
 */
export const QUESTION_ORDER: readonly QuestionKind[] = [
  "AGE_CHECK",
  "TOBACCO_NUMBER",
  "TOBACCO_PICK",
  "POINT_CARD",
  "WARM",
  "SEPARATE_BAG",
  "BAG",
  "BAG_SIZE",
  "CHOPSTICKS",
  "SPOON",
  "STRAW",
  "ODEN_COUNT",
  "KARASHI",
  "SAUCE",
  "TOTAL",
  "PAY",
  "RECEIPT_ASK",
  "CAUTION_HOT",
];

/** 돌발 이벤트 손님의 질문 종류 (Lv3 부터, 물건 없이 온다) */
export type EventKind = "DIRECTIONS" | "TOILET" | "COPIER" | "ATM" | "DELIVERY" | "UTILITY_BILL" | "TICKET";
export const EVENT_KINDS: readonly EventKind[] = [
  "DIRECTIONS",
  "TOILET",
  "COPIER",
  "ATM",
  "DELIVERY",
  "UTILITY_BILL",
  "TICKET",
];

/** 모든 질문 종류 (스키마·검증용) */
export const QUESTION_KINDS: readonly QuestionKind[] = [...QUESTION_ORDER, "LISTEN", ...EVENT_KINDS];

/** LISTEN(리스닝 전용) 단계가 대신할 수 있는 질문 — 손님이 「お箸つけて」처럼 먼저 말한다 */
export type ListenTarget = "WARM" | "BAG" | "CHOPSTICKS" | "SPOON" | "STRAW";
export const LISTEN_TARGETS: readonly ListenTarget[] = ["WARM", "BAG", "CHOPSTICKS", "SPOON", "STRAW"];

/** 길 묻기 이벤트의 방향 */
export type Direction = "right" | "left" | "straight" | "back";
export const DIRECTIONS: readonly Direction[] = ["right", "left", "straight", "back"];

/** 질문 종류 → 그 질문을 발생시키는 태그. (BAG/TOTAL/PAY/POINT_CARD 등은 태그가 아닌 규칙으로 발생) */
export const QUESTION_TAG: Partial<Record<QuestionKind, ItemTag>> = {
  AGE_CHECK: "alcohol", // tobacco 도 함께 — resolver 가 처리
  TOBACCO_NUMBER: "tobacco",
  TOBACCO_PICK: "tobacco",
  WARM: "hot",
  SEPARATE_BAG: "hot", // hot + cold 동시
  CHOPSTICKS: "chopsticks",
  SPOON: "spoon",
  STRAW: "straw",
  ODEN_COUNT: "oden",
  KARASHI: "oden",
  SAUCE: "fried",
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
  | "counter"
  | "amount"
  | "payment"
  | "caution"
  | "greeting"
  | "service"
  | "direction";

/**
 * 접객 문구.
 * - kind 가 있으면 그 질문의 정답. PAY 는 payment 별로, DIRECTIONS 는 direction 별로 정답이 하나씩.
 * - kind 가 null 이면 오답 전용 문구(존재하지 않는 서비스, 다른 타이밍의 인사 등).
 */
export interface Phrase {
  id: string;
  kind: QuestionKind | null;
  payment?: PaymentMethod;
  direction?: Direction;
  category: PhraseCategory;
  /** 일본어 본문. TOTAL 문구는 "{total}" 플레이스홀더를 가진다. */
  ja: string;
  /** 한국어 번역(항상 부제로, 작게) */
  ko: string;
  /** 히라가나 읽기(선택) — 후리가나 줄 */
  reading?: string;
  /** 단어 분해 한 줄 (도감 문장 카드를 길게 누르면 보인다). 예: "温め(데우다)+ます(정중)+か(의문)" */
  parts?: string;
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
  /** 담배 선반 번호("23"). tobacco 태그 상품만 — 번호 매칭 미니게임에 쓴다 */
  code?: string;
  /** 시즌 한정 상품이면 등장하는 달(1~12). 없으면 연중 */
  season?: number;
}

/** 손님의 짧은 응답(「お願いします」「大丈夫です」 등). en 은 외국인 관광객용 영어(선택) */
export interface CustomerReply {
  ja: string;
  ko: string;
  en?: string;
  /** 히라가나 읽기(선택) — 도감 문장 카드의 후리가나 줄 */
  reading?: string;
  /** 단어 분해 한 줄(선택) — 도감 문장 카드를 길게 누르면 보인다 */
  parts?: string;
}

/** 레귤러 호감도 단계별 대사 */
export interface RegularLine {
  /** 이 대사가 열리는 호감도(1~5) */
  affinity: number;
  ja: string;
  ko: string;
}

export type RankId = "shinjin" | "ippan" | "senpai" | "leader" | "fukutencho" | "tencho";
export const RANK_IDS: readonly RankId[] = ["shinjin", "ippan", "senpai", "leader", "fukutencho", "tencho"];

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

export type ManagerMoment =
  | "home"
  | "shift_end_good"
  | "shift_end_mid"
  | "shift_end_bad"
  | "absent"
  | "exam_ready"
  | "exam_pass"
  | "exam_fail"
  | "season";

export interface ManagerLine {
  when: ManagerMoment;
  /** 특정 시간대 전용이면 지정 */
  slot?: ShiftSlot;
  /** season 대사는 달(1~12) 지정 */
  month?: number;
  ja: string;
  ko: string;
}

/** 승급 시험(점장 점검 시프트) 기준 — 최고 콤보가 combo 이상이고 이탈 0 이면 합격 */
export interface ExamRule {
  /** 시험으로 쓰는 시프트 설정(시간대) */
  slot: ShiftSlot;
  combo: number;
}

export interface RankDef {
  id: RankId;
  ja: string;
  ko: string;
  /** 이 직급의 승급 시험을 볼 수 있게 되는 누적 완료 시프트 수 */
  shiftsRequired: number;
  /** 승급 시 해금되는 태그 */
  unlocksTags: ItemTag[];
  /** 이 직급으로 올라가기 위한 시험. 없으면(최초 직급) 시험 없음 */
  exam?: ExamRule;
}

/** 시즌 규칙 변경 — 그 달에만 적용되는 접객 규칙 (Papers, Please 식 규칙 갱신) */
export type SeasonRule =
  /** 봉투 유료화 → BAG 뒤에 사이즈 질문(BAG_SIZE)이 붙는다 */
  | { kind: "bagSize" }
  /** 포인트 캠페인 → 모든 손님에게 포인트카드를 묻는다 */
  | { kind: "pointCardAlways" }
  /** 영수증 캠페인 → 결제 뒤 영수증 필요 여부(RECEIPT_ASK)를 묻는다 */
  | { kind: "receiptAsk" };

/** 월별 시즌 — 한정 상품·한정 단골·포스터·규칙 변경 공지 */
export interface Season {
  /** 1~12 */
  month: number;
  nameJa: string;
  nameKo: string;
  /** 매장 포스터 문구(씬 뒷벽) */
  posterJa: string;
  /** 규칙 변경 공지 — 홈과 출근 시트에 보인다 */
  noticeJa?: string;
  noticeKo?: string;
  rule?: SeasonRule;
}

export interface ShiftConfig {
  slot: ShiftSlot;
  /** 한자 한 글자 배지 (朝/昼/夕/深) */
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
  /** 선택지 하나가 가려져(한자 → 〇) 나오는 확률 (Lv2 부터) */
  maskChance?: number;
  /** 질문 하나가 리스닝 전용(LISTEN)으로 바뀌는 확률 (Lv2 부터) */
  listenChance?: number;
  /** 돌발 이벤트 손님 확률 (Lv3 부터) */
  eventChance?: number;
  /** 취객 확률 (Lv4) — 대사가 흔들리고 일부가 가려진다 */
  drunkChance?: number;
  /** 외국인 관광객 확률 (Lv3 부터) — 영어로 말한다 */
  touristChance?: number;
  /** 이 직급부터 출근 가능 */
  requiredRank?: RankId;
  /** 하루 기본 시프트가 아닌 추가 근무(심야). 셋 다 끝낸 뒤 열리고 フルシフト 집계에 들어가지 않는다 */
  optional?: boolean;
}

/** LISTEN 선택지(아이콘) 라벨 */
export interface ListenTargetLabel {
  ja: string;
  ko: string;
  /** UI 아이콘 이름 (IconName) */
  icon: string;
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
  /** LISTEN: 손님이 먼저 말하는 요구 (대신할 질문 종류별). en 이 있으면 관광객은 영어로 말한다 */
  listenRequests: Partial<Record<ListenTarget, CustomerReply[]>>;
  /** LISTEN 선택지 라벨(아이콘) */
  listenTargets: Record<ListenTarget, ListenTargetLabel>;
  /** 돌발 이벤트 손님의 첫마디 (종류별) */
  eventPrompts: Record<EventKind, CustomerReply[]>;
  /** 담배 번호 요구 템플릿 — "{n}" 에 선반 번호가 들어간다 */
  tobaccoRequests: CustomerReply[];
  /** 월별 시즌 */
  seasons: Season[];
}

/* ───────────────────────── 런타임(시프트 진행) 타입 ───────────────────────── */

export interface QuestionStep {
  kind: QuestionKind;
  correctPhraseId: string;
  /** 질문 동안 손님이 말하는 한마디 (LISTEN 요구, 담배 번호, 돌발 이벤트 첫마디) */
  prompt?: CustomerReply;
  /** LISTEN 이 대신하는 원래 질문 — 태그 가중치·통계는 이 종류로 센다 */
  target?: ListenTarget;
}

export interface AnswerOption {
  phraseId: string;
  ja: string;
  ko: string;
  isCorrect: boolean;
  /** 히라가나 읽기 (후리가나 줄) */
  reading?: string;
  /** 가려진 선택지 — 한자가 〇 로 바뀐 채 보인다(플레이어가 이미 아는 문장) */
  masked?: boolean;
  /** LISTEN 선택지의 아이콘 이름 */
  icon?: string;
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
  /** 말하기 모드(음성 인식)로 답했는지 */
  spoken: boolean;
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
  /** 돌발 이벤트 손님이면 그 종류 (물건 없이 온다) */
  event: EventKind | null;
  /** 길 묻기 이벤트의 정답 방향 */
  direction: Direction | null;
  /** 담배 손님의 선반 번호 */
  tobaccoNumber: string | null;
  /** 취객 — 대사가 흔들리고 일부가 「…」로 가려진다 */
  drunk: boolean;
  /** 외국인 관광객 — 영어(en)로 말한다 */
  tourist: boolean;
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

/** 승급 시험 중이면 그 정보 */
export interface ExamContext {
  rank: RankId;
  comboRequired: number;
}

export interface ShiftState {
  config: ShiftConfig;
  seed: number;
  /** START 이벤트를 받았는가. false 면 phase 'enter' 라도 손님이 없는 대기 상태 */
  started: boolean;
  /** 해금 반영 후 이 시프트에서 실제로 활성인 태그 (effectiveActiveTags) */
  activeTags: ItemTag[];
  /** 이 시프트에 등장 가능한 레귤러 id (content.regulars 에서 조회) */
  regularPool: string[];
  /** 플레이 중인 달(1~12) — 시즌 상품·규칙 */
  month: number;
  /** 이번 달 시즌(없으면 null) */
  season: Season | null;
  /** 승급 시험이면 그 정보 */
  exam: ExamContext | null;
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
  /** 말하기 모드로 맞힌 수 */
  spokens: number;
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
  | { type: "ANSWER"; phraseId: string; spoken?: boolean }
  | { type: "SKIP_PHASE" };

export interface HardestPhrase {
  phraseId: string;
  kind: QuestionKind;
  wrongCount: number;
  lateCount: number;
}

/** 승급 시험 결과 (영수증·프로필 반영) */
export interface ExamResult {
  rank: RankId;
  comboRequired: number;
  passed: boolean;
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
  /** 말하기 모드로 맞힌 응대 수 (시급 보너스) */
  spokens: number;
  hardest: HardestPhrase | null;
  /** 이 시프트로 변한 시급(¥) */
  wageDelta: number;
  /** 시프트 후 시급(¥) */
  wageAfter: number;
  /** 처음으로 Perfect 를 낸 태그(보너스) */
  firstSuccessTags: ItemTag[];
  regularsMet: string[];
  endedBy: "time" | "customers" | "manager";
  /** 승급 시험이었으면 결과, 아니면 null */
  exam: ExamResult | null;
  /** 처리한 돌발 이벤트 손님 수 */
  events: number;
  /** 추후 분석용 */
  answers: AnswerLog[];
}
