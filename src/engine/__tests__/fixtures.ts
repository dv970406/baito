/**
 * 테스트 전용 최소 콘텐츠. 실제 konbini 데이터와 무관하게 엔진 규칙만 검증한다.
 */
import { QUESTION_KINDS } from "../types";
import type {
  CustomerSpec,
  Item,
  ItemTag,
  Phrase,
  QuestionKind,
  Regular,
  ShiftConfig,
  ShiftSlot,
  WorkplaceContent,
  CustomerReply,
} from "../types";

const visual = { shape: "box", color: "#888" } as const;

export const ITEMS: Record<string, Item> = {
  bento: { id: "bento", ja: "お弁当", ko: "도시락", price: 498, tags: ["hot", "chopsticks"], level: 1, visual },
  onigiri: { id: "onigiri", ja: "おにぎり", ko: "오니기리", price: 130, tags: ["hot"], level: 1, visual },
  ice: { id: "ice", ja: "アイス", ko: "아이스크림", price: 180, tags: ["cold"], level: 1, visual },
  pudding: { id: "pudding", ja: "プリン", ko: "푸딩", price: 150, tags: ["cold", "spoon"], level: 1, visual },
  gum: { id: "gum", ja: "ガム", ko: "껌", price: 120, tags: [], level: 1, visual },
  water: { id: "water", ja: "水", ko: "물", price: 110, tags: [], level: 1, visual },
  teaPack: { id: "teaPack", ja: "パック茶", ko: "팩 음료", price: 128, tags: ["straw"], level: 2, visual },
  hotCoffee: { id: "hotCoffee", ja: "ホットコーヒー", ko: "뜨거운 커피", price: 150, tags: ["fragile_hot"], level: 2, visual },
  beer: { id: "beer", ja: "ビール", ko: "맥주", price: 230, tags: ["alcohol"], level: 3, visual },
  cigarettes: { id: "cigarettes", ja: "タバコ", ko: "담배", price: 600, tags: ["tobacco"], level: 3, visual },
};

export const PHRASES: Phrase[] = [
  // 정답 문구
  { id: "warm", kind: "WARM", category: "temperature", ja: "温めますか？", ko: "데워드릴까요?", level: 1 },
  { id: "sepbag", kind: "SEPARATE_BAG", category: "bag", ja: "袋は別々にしますか？", ko: "봉투 따로 담을까요?", level: 2 },
  { id: "bag", kind: "BAG", category: "bag", ja: "レジ袋はご利用ですか？", ko: "봉투 필요하세요?", level: 1 },
  { id: "chop", kind: "CHOPSTICKS", category: "utensil", ja: "お箸はお付けしますか？", ko: "젓가락 드릴까요?", level: 1 },
  { id: "spoon", kind: "SPOON", category: "utensil", ja: "スプーンはお付けしますか？", ko: "스푼 드릴까요?", level: 1 },
  { id: "straw", kind: "STRAW", category: "utensil", ja: "ストローはお使いですか？", ko: "빨대 쓰세요?", level: 2 },
  { id: "total", kind: "TOTAL", category: "amount", ja: "合計で {total}です", ko: "합계 {total}입니다", level: 1 },
  { id: "pay.cash", kind: "PAY", payment: "cash", category: "payment", ja: "お預かりします", ko: "받았습니다", level: 1 },
  { id: "pay.ic", kind: "PAY", payment: "ic", category: "payment", ja: "タッチお願いします", ko: "터치해 주세요", level: 1 },
  { id: "pay.qr", kind: "PAY", payment: "qr", category: "payment", ja: "バーコードお見せください", ko: "바코드 보여주세요", level: 1 },
  { id: "pay.credit", kind: "PAY", payment: "credit", category: "payment", ja: "一括でよろしいですか？", ko: "일시불로 할까요?", level: 1 },
  { id: "age", kind: "AGE_CHECK", category: "age", ja: "年齢確認ボタンをタッチしてください", ko: "연령 확인 버튼을 눌러주세요", level: 3 },
  { id: "point", kind: "POINT_CARD", category: "point", ja: "ポイントカードはお持ちですか？", ko: "포인트카드 있으세요?", level: 2 },
  { id: "caution", kind: "CAUTION_HOT", category: "caution", ja: "お熱いのでお気をつけください", ko: "뜨거우니 조심하세요", level: 2 },
  // 오답 전용 문구
  { id: "d.cool", kind: null, category: "temperature", ja: "冷やしますか？", ko: "차갑게 해드릴까요?", level: 1, stage: "WARM" },
  { id: "d.thanks", kind: null, category: "greeting", ja: "ありがとうございました", ko: "감사합니다", level: 1, stage: "THANKS" },
  { id: "d.hello", kind: null, category: "greeting", ja: "いらっしゃいませ", ko: "어서오세요", level: 1, stage: "GREETING" },
  { id: "d.bagfee", kind: null, category: "bag", ja: "袋は有料です", ko: "봉투는 유료입니다", level: 1, stage: "BAG" },
  { id: "d.fork", kind: null, category: "utensil", ja: "フォークはお付けしますか？", ko: "포크 드릴까요?", level: 1, stage: "SPOON" },
];

export const REGULARS: Regular[] = [
  {
    id: "tanaka",
    nameJa: "田中",
    nameKo: "다나카",
    role: "샐러리맨",
    slots: ["asa"],
    purchase: ["onigiri", "water"],
    payment: "ic",
    tic: "いつもの",
    ticKo: "늘 먹던 거",
    lines: [],
    firstWords: [],
    unlock: { type: "open" },
    visual: { skin: "#f", hairColor: "#0", hairStyle: "short", outfit: "#2" },
    patienceBonus: 1,
  },
  {
    id: "yui",
    nameJa: "ゆい",
    nameKo: "유이",
    role: "간호사",
    slots: ["yoru"],
    purchase: ["bento", "pudding"],
    payment: "qr",
    tic: "…",
    ticKo: "…",
    lines: [],
    firstWords: [],
    unlock: { type: "slot", slot: "yoru", label: "저녁" },
    visual: { skin: "#f", hairColor: "#0", hairStyle: "long", outfit: "#2" },
  },
];

const SHIFT_BASE = {
  kanji: "朝",
  nameKo: "아침",
  hours: "07:00–10:00",
  durationSec: 180,
  customerCount: 3,
  questionTimeSec: 6,
  pointCardChance: 0,
  itemsPerCustomer: [1, 3] as [number, number],
  descriptionKo: "테스트",
};

export const SHIFTS: Record<ShiftSlot, ShiftConfig> = {
  asa: { ...SHIFT_BASE, slot: "asa", level: 1, activeTags: ["hot", "cold", "chopsticks", "spoon"] },
  hiru: {
    ...SHIFT_BASE,
    slot: "hiru",
    kanji: "昼",
    nameKo: "낮",
    level: 2,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "fragile_hot"],
    pointCardChance: 0.3,
  },
  yoru: {
    ...SHIFT_BASE,
    slot: "yoru",
    kanji: "夕",
    nameKo: "저녁",
    level: 3,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "fragile_hot", "alcohol", "tobacco"],
  },
  shinya: {
    ...SHIFT_BASE,
    slot: "shinya",
    kanji: "深",
    nameKo: "심야",
    level: 4,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "fragile_hot", "alcohol", "tobacco", "oden", "fried"],
    requiredRank: "senpai",
    optional: true,
  },
};

const KINDS: readonly QuestionKind[] = QUESTION_KINDS;

const REPLIES = Object.fromEntries(
  KINDS.map((kind) => [kind, [{ ja: `はい(${kind})`, ko: "네" }, { ja: `大丈夫です(${kind})`, ko: "괜찮아요" }]]),
) as Record<QuestionKind, CustomerReply[]>;

export const CONTENT: WorkplaceContent = {
  id: "konbini",
  code: "TEST",
  nameJa: "テスト",
  nameKo: "테스트",
  storeNameJa: "テストマート",
  storeBranchJa: "本店",
  registerLabel: "レジ 01",
  items: Object.values(ITEMS),
  phrases: PHRASES,
  regulars: REGULARS,
  manager: [],
  ranks: [
    { id: "shinjin", ja: "新人", ko: "신입", shiftsRequired: 0, unlocksTags: [] },
    { id: "ippan", ja: "一般", ko: "일반", shiftsRequired: 3, unlocksTags: ["alcohol"] },
    { id: "senpai", ja: "先輩", ko: "선배", shiftsRequired: 7, unlocksTags: ["tobacco"] },
    { id: "leader", ja: "リーダー", ko: "리더", shiftsRequired: 12, unlocksTags: [] },
    { id: "fukutencho", ja: "副店長", ko: "부점장", shiftsRequired: 20, unlocksTags: [] },
    { id: "tencho", ja: "店長", ko: "점장", shiftsRequired: 30, unlocksTags: [] },
  ],
  shifts: SHIFTS,
  replies: REPLIES,
  confusedReplies: [{ ja: "へ？", ko: "에?" }, { ja: "いや、あの…", ko: "아니, 그게…" }],
  hints: { WARM: { ja: "温めてください", ko: "데워주세요" } },
  leaveReplies: [{ ja: "もういいです", ko: "됐어요" }],
  listenRequests: {
    WARM: [{ ja: "温めて", ko: "데워 줘요", en: "Can you heat it up?" }],
    CHOPSTICKS: [{ ja: "お箸つけて", ko: "젓가락 넣어 줘요", en: "Chopsticks, please." }],
    SPOON: [{ ja: "スプーンつけて", ko: "스푼 넣어 줘요" }],
  },
  listenTargets: {
    WARM: { ja: "温め", ko: "데우기", icon: "cup" },
    BAG: { ja: "袋", ko: "봉투", icon: "bag" },
    CHOPSTICKS: { ja: "お箸", ko: "젓가락", icon: "chopsticks" },
    SPOON: { ja: "スプーン", ko: "스푼", icon: "spoon" },
    STRAW: { ja: "ストロー", ko: "빨대", icon: "straw" },
  },
  eventPrompts: {
    DIRECTIONS: [{ ja: "駅はどっちですか？", ko: "역은 어느 쪽이에요?", en: "Which way is the station?" }],
    TOILET: [{ ja: "トイレどこですか？", ko: "화장실 어디예요?" }],
    COPIER: [{ ja: "コピー機、動かないんですけど", ko: "복사기가 안 되는데요" }],
    ATM: [{ ja: "ATM、使い方が…", ko: "ATM 사용법이…" }],
    DELIVERY: [{ ja: "これ、送りたいんですけど", ko: "이거 보내고 싶은데요" }],
    UTILITY_BILL: [{ ja: "電気代、払えますか？", ko: "전기 요금 낼 수 있어요?" }],
    TICKET: [{ ja: "チケット、ここで取れますか？", ko: "티켓 여기서 뽑을 수 있어요?" }],
  },
  tobaccoRequests: [{ ja: "{n}番お願いします", ko: "{n}번 주세요", en: "Number {n}, please." }],
  seasons: [],
};

/** 상품 목록으로 손님 하나를 만든다 */
export function customerOf(
  items: Item[],
  overrides: Partial<Omit<CustomerSpec, "items" | "total" | "tagSet">> = {},
): CustomerSpec {
  const tags = new Set<ItemTag>();
  for (const item of items) for (const tag of item.tags) tags.add(tag);
  return {
    index: 0,
    regularId: null,
    payment: "cash",
    patienceMax: 4,
    event: null,
    direction: null,
    tobaccoNumber: null,
    drunk: false,
    tourist: false,
    ...overrides,
    items,
    total: items.reduce((sum, item) => sum + item.price, 0),
    tagSet: Array.from(tags).sort(),
  };
}
