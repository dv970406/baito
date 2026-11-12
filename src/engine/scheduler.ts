/**
 * 손님 생성기 = 위장된 SRS.
 * 모든 학습 개입은 "어떤 태그의 상품을 든 손님이 얼마나 자주 오는가" 하나로 구현된다.
 * 플레이어는 우연이라고 느끼고, 엔진은 간격 반복을 돌린다.
 */
import { tagSetKey, tagSetOf } from "./cartResolver";
import { PATIENCE_MAX } from "./scoring";
import { DIRECTIONS, EVENT_KINDS, ITEM_TAGS } from "./types";
import type {
  CustomerSpec,
  Direction,
  EventKind,
  Item,
  ItemTag,
  PaymentMethod,
  Regular,
  ShiftConfig,
  TagWeights,
  WorkplaceContent,
} from "./types";
import type { Rng } from "./rng";

/* ───────────────────────── 가중치 ───────────────────────── */

/** 모든 태그 가중치 1 */
export function initialTagWeights(): TagWeights {
  const w = {} as TagWeights;
  for (const tag of ITEM_TAGS) w[tag] = 1;
  return w;
}

export const WEIGHT_FLOOR = 0.2;
export const WEIGHT_CAP = 8;

/** 결과별 가중치 배율: Perfect 는 간격 증가, 틀리면 간격 리셋 */
const WEIGHT_FACTOR = { perfect: 0.6, correct: 0.9, wrong: 2.5 } as const;

/**
 * 답변 결과를 태그 가중치에 반영한 새 객체.
 * perfect ×0.6, correct ×0.9, wrong ×2.5, [WEIGHT_FLOOR, WEIGHT_CAP] 클램프. tag 가 없으면 그대로 복사.
 */
export function applyAnswerToWeights(
  w: TagWeights,
  tag: ItemTag | undefined,
  result: "perfect" | "correct" | "wrong",
): TagWeights {
  const next = { ...w };
  if (tag === undefined) return next;
  const base = next[tag] ?? 1;
  next[tag] = Math.min(WEIGHT_CAP, Math.max(WEIGHT_FLOOR, base * WEIGHT_FACTOR[result]));
  return next;
}

/* ───────────────────────── 활성 태그 ───────────────────────── */

/** 승급으로 해금되어야만 등장하는 태그 */
export const RANK_GATED_TAGS: readonly ItemTag[] = ["alcohol", "tobacco"];

/** 시프트 설정의 activeTags 에서 아직 해금되지 않은 직급 게이트 태그를 뺀 것 */
export function effectiveActiveTags(config: ShiftConfig, unlockedTags: ItemTag[]): ItemTag[] {
  return config.activeTags.filter((tag) => !RANK_GATED_TAGS.includes(tag) || unlockedTags.includes(tag));
}

/* ───────────────────────── 손님 생성 ───────────────────────── */

export interface GenerateContext {
  content: WorkplaceContent;
  config: ShiftConfig;
  /** 이 시프트에서 몇 번째 손님인지 (0부터) */
  index: number;
  rng: Rng;
  tagWeights: TagWeights;
  /** 직전 손님들의 tagSetKey — 같은 조합 연속 금지 */
  recentTagSets: string[];
  /** 틀린 뒤 재등장을 보장해야 하는 태그 */
  pendingRetryTags: ItemTag[];
  regularsAvailable: Regular[];
  /** 이번 시프트에 이미 등장한 레귤러 id */
  regularsAlreadyMet: string[];
  /** 레귤러 등장 확률 (기본 0.35) */
  regularChance?: number;
  /**
   * 활성 태그 덮어쓰기 (해금 반영 후의 effectiveActiveTags).
   * 생략하면 config.activeTags 를 그대로 쓴다.
   */
  activeTags?: ItemTag[];
  /** 플레이 중인 달(1~12). 시즌 한정 상품은 그 달에만 등장한다. 생략하면 시즌 상품 제외 */
  month?: number;
}

/** 돌발 이벤트가 열리는 최소 레벨 */
export const EVENT_MIN_LEVEL = 3;
/** 외국인 관광객이 오는 최소 레벨 */
export const TOURIST_MIN_LEVEL = 3;
/** 취객이 오는 최소 레벨 */
export const DRUNK_MIN_LEVEL = 4;

export const DEFAULT_REGULAR_CHANCE = 0.35;

/** 익명 손님 결제 수단 분포: cash 0.4 / ic 0.3 / qr 0.2 / credit 0.1 */
export const PAYMENT_DISTRIBUTION: readonly { method: PaymentMethod; p: number }[] = [
  { method: "cash", p: 0.4 },
  { method: "ic", p: 0.3 },
  { method: "qr", p: 0.2 },
  { method: "credit", p: 0.1 },
];

/** 중복 조합 회피 재시도 횟수 */
const TAGSET_RETRY_LIMIT = 12;

/** 익명 손님 결제 수단을 분포에 따라 고른다 */
export function rollPayment(rng: Rng): PaymentMethod {
  const r = rng.next();
  let acc = 0;
  for (const { method, p } of PAYMENT_DISTRIBUTION) {
    acc += p;
    if (r < acc) return method;
  }
  return PAYMENT_DISTRIBUTION[PAYMENT_DISTRIBUTION.length - 1].method;
}

/**
 * 레벨에 맞고 모든 태그가 활성인 상품만 (태그 없는 상품은 항상 등장 가능).
 * 시즌 한정 상품(item.season)은 month 가 그 달일 때만.
 */
export function eligibleItems(items: Item[], level: number, activeTags: ItemTag[], month?: number): Item[] {
  return items.filter(
    (item) =>
      item.level <= level &&
      item.tags.every((tag) => activeTags.includes(tag)) &&
      (item.season === undefined || item.season === month),
  );
}

/** 상품 가중치 = 태그 가중치 중 최댓값 (태그 없으면 1) */
function itemWeight(item: Item, weights: TagWeights): number {
  if (item.tags.length === 0) return 1;
  return Math.max(...item.tags.map((tag) => weights[tag] ?? 1));
}

/** 가중 랜덤 선택 */
function weightedPick(items: Item[], weights: TagWeights, rng: Rng): Item {
  const ws = items.map((item) => itemWeight(item, weights));
  const sum = ws.reduce((a, b) => a + b, 0);
  let r = rng.next() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * 익명 손님의 장바구니 한 벌을 만든다.
 * pendingRetryTags 가 있으면 첫 상품은 그 태그를 가진 상품에서 고른다(재등장 보장).
 * 나머지는 중복 없는 가중 선택.
 */
function rollCart(eligible: Item[], count: number, ctx: GenerateContext): Item[] {
  const remaining = eligible.slice();
  const cart: Item[] = [];

  if (ctx.pendingRetryTags.length > 0) {
    const retry = remaining.filter((item) => item.tags.some((tag) => ctx.pendingRetryTags.includes(tag)));
    if (retry.length > 0) {
      const forced = weightedPick(retry, ctx.tagWeights, ctx.rng);
      cart.push(forced);
      remaining.splice(remaining.indexOf(forced), 1);
    }
  }

  while (cart.length < count && remaining.length > 0) {
    const picked = weightedPick(remaining, ctx.tagWeights, ctx.rng);
    cart.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return cart;
}

/** 직전 손님들과 태그 집합이 겹치지 않는 장바구니. 12번 시도 후에는 그냥 받아들인다 */
function rollAnonymousCart(eligible: Item[], ctx: GenerateContext): Item[] {
  const [minRaw, maxRaw] = ctx.config.itemsPerCustomer;
  const min = Math.max(1, Math.min(minRaw, eligible.length));
  const max = Math.max(min, Math.min(maxRaw, eligible.length));

  let cart: Item[] = [];
  for (let attempt = 0; attempt < TAGSET_RETRY_LIMIT; attempt++) {
    const count = ctx.rng.int(min, max);
    cart = rollCart(eligible, count, ctx);
    if (!ctx.recentTagSets.includes(tagSetKey(tagSetOf(cart)))) break;
  }
  return cart;
}

/**
 * 손님 1명 생성.
 * - 등장 가능 상품: level ≤ config.level, 모든 태그가 활성
 * - regularChance 확률로 (이번 시프트에 아직 안 나온, 이 시간대에 오는) 레귤러 1명 — 고정 구매 패턴과 결제 수단 사용
 *   (레귤러의 구매 패턴은 "외워지는 것"이 목적이므로 중복 조합 회피·재등장 보장 규칙을 거치지 않는다)
 * - 익명 손님: 가중 상품 선택, pendingRetryTags 우선, 직전 조합 회피, 결제 수단 분포 cash/ic/qr/credit = 4/3/2/1
 * - patienceMax = PATIENCE_MAX + regular.patienceBonus
 * - Lv3 부터 eventChance 로 돌발 이벤트 손님(물건 없음), touristChance 로 관광객, Lv4 부터 drunkChance 로 취객
 * - 담배 상품(code)이 있으면 tobaccoNumber 가 채워진다 (번호 매칭 미니게임)
 * 포인트카드 여부는 여기서 정하지 않는다(shift.ts 가 큐를 만들 때 결정).
 */
export function generateCustomer(ctx: GenerateContext): CustomerSpec {
  const activeTags = ctx.activeTags ?? ctx.config.activeTags;
  const eligible = eligibleItems(ctx.content.items, ctx.config.level, activeTags, ctx.month);
  if (eligible.length === 0) {
    throw new Error(`generateCustomer: 레벨 ${ctx.config.level} 에서 등장 가능한 상품이 없다`);
  }

  const candidates = ctx.regularsAvailable.filter(
    (regular) => !ctx.regularsAlreadyMet.includes(regular.id) && regular.slots.includes(ctx.config.slot),
  );
  const regular =
    candidates.length > 0 && ctx.rng.chance(ctx.regularChance ?? DEFAULT_REGULAR_CHANCE)
      ? ctx.rng.pick(candidates)
      : null;

  const base = {
    index: ctx.index,
    patienceMax: PATIENCE_MAX + (regular?.patienceBonus ?? 0),
    event: null,
    direction: null,
    tobaccoNumber: null,
    drunk: false,
    tourist: false,
  };

  // 돌발 이벤트 손님 — 물건 없이 온다. 레귤러에게는 일어나지 않는다
  if (!regular && ctx.config.level >= EVENT_MIN_LEVEL && ctx.rng.chance(ctx.config.eventChance ?? 0)) {
    const event = rollEvent(ctx.rng);
    return {
      ...base,
      regularId: null,
      items: [],
      payment: "cash",
      total: 0,
      tagSet: [],
      event,
      direction: event === "DIRECTIONS" ? ctx.rng.pick([...DIRECTIONS] as Direction[]) : null,
      // 관광객은 길을 자주 묻는다
      tourist:
        ctx.config.level >= TOURIST_MIN_LEVEL && ctx.rng.chance((ctx.config.touristChance ?? 0) * 2),
    };
  }

  let items: Item[] = [];
  let payment: PaymentMethod;

  if (regular) {
    // 단골의 고정 구매는 "외워지는 패턴"이라 레벨과 무관하다. 활성 태그(직급 해금 포함)와 시즌만 본다
    const regularPool = eligibleItems(ctx.content.items, Number.POSITIVE_INFINITY, activeTags, ctx.month);
    items = regular.purchase
      .map((id) => regularPool.find((item) => item.id === id))
      .filter((item): item is Item => item !== undefined);
    payment = regular.payment;
  } else {
    payment = rollPayment(ctx.rng);
  }
  if (items.length === 0) {
    items = rollAnonymousCart(eligible, ctx);
  }

  // 익명 손님 수식어 — 취객(Lv4) / 관광객(Lv3). 둘 다는 아니다
  let drunk = false;
  let tourist = false;
  if (!regular) {
    if (ctx.config.level >= DRUNK_MIN_LEVEL && ctx.rng.chance(ctx.config.drunkChance ?? 0)) drunk = true;
    else if (ctx.config.level >= TOURIST_MIN_LEVEL && ctx.rng.chance(ctx.config.touristChance ?? 0)) tourist = true;
  }

  const tobaccoItem = items.find((item) => item.tags.includes("tobacco") && item.code);

  return {
    ...base,
    regularId: regular?.id ?? null,
    items,
    payment,
    total: items.reduce((sum, item) => sum + item.price, 0),
    tagSet: tagSetOf(items),
    tobaccoNumber: tobaccoItem?.code ?? null,
    drunk,
    tourist,
  };
}

/** 돌발 이벤트 종류를 고른다 (균등) */
export function rollEvent(rng: Rng): EventKind {
  return rng.pick([...EVENT_KINDS] as EventKind[]);
}
