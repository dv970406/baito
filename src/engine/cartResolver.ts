/**
 * 장바구니 → 질문 큐 변환기.
 * 상품 태그 집합과 레벨·활성 태그·포인트카드 여부·시즌 규칙으로 "이 손님에게 해야 할 질문"을 접객 순서대로 뽑는다.
 */
import { ITEM_TAGS, QUESTION_ORDER } from "./types";
import type { Item, ItemTag, QuestionKind, SeasonRule } from "./types";

export interface ResolveContext {
  level: number;
  /** 이 시프트에서 활성화된 태그(해금 반영 후) */
  activeTags: ItemTag[];
  /** 포인트카드 질문 발동 여부 (shift.ts 가 확률로 결정) */
  pointCard: boolean;
  /** 담배 손님의 선반 번호 — 있으면 번호 매칭 두 단계(TOBACCO_NUMBER → TOBACCO_PICK)가 붙는다 */
  tobaccoNumber?: string | null;
  /** 이번 달 시즌 규칙 */
  rule?: SeasonRule | null;
}

/** 상품들의 태그 집합 — ITEM_TAGS 순서로 정렬된 중복 없는 배열 */
export function tagSetOf(items: Item[]): ItemTag[] {
  const set = new Set<ItemTag>();
  for (const item of items) {
    for (const tag of item.tags) set.add(tag);
  }
  return ITEM_TAGS.filter((tag) => set.has(tag));
}

/** 태그 집합의 문자열 키 ("cold|hot") — 직전 손님 중복 방지용. 알파벳 순으로 정렬한다 */
export function tagSetKey(tags: ItemTag[]): string {
  return Array.from(new Set(tags)).sort().join("|");
}

/** 상품 조합 → 접객 순서대로 정렬된 질문 종류 배열 */
export function resolveCart(items: Item[], ctx: ResolveContext): QuestionKind[] {
  const tags = tagSetOf(items);
  const active = new Set(ctx.activeTags);
  /** 태그가 장바구니에 있고 이 시프트에서 활성인가 */
  const live = (tag: ItemTag): boolean => tags.includes(tag) && active.has(tag);
  const rule = ctx.rule?.kind ?? null;

  const kinds = new Set<QuestionKind>();

  if (live("alcohol") || live("tobacco")) kinds.add("AGE_CHECK");
  if (live("tobacco") && ctx.tobaccoNumber) {
    kinds.add("TOBACCO_NUMBER");
    kinds.add("TOBACCO_PICK");
  }
  if (ctx.pointCard) kinds.add("POINT_CARD");
  if (live("hot")) kinds.add("WARM");
  if (live("hot") && live("cold") && ctx.level >= 2) kinds.add("SEPARATE_BAG");
  if (items.length >= 2) {
    kinds.add("BAG");
    if (rule === "bagSize") kinds.add("BAG_SIZE");
  }
  if (live("chopsticks")) kinds.add("CHOPSTICKS");
  if (live("spoon")) kinds.add("SPOON");
  if (live("straw")) kinds.add("STRAW");
  if (live("oden")) {
    kinds.add("ODEN_COUNT");
    kinds.add("KARASHI");
  }
  if (live("fried")) kinds.add("SAUCE");
  kinds.add("TOTAL");
  kinds.add("PAY");
  if (rule === "receiptAsk") kinds.add("RECEIPT_ASK");
  if (live("fragile_hot")) kinds.add("CAUTION_HOT");

  return QUESTION_ORDER.filter((kind) => kinds.has(kind));
}
