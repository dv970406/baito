import { describe, expect, it } from "vitest";
import {
  ITEM_TAGS,
  PAYMENT_METHODS,
  QUESTION_ORDER,
  SHIFT_SLOTS,
  type ItemTag,
  type PaymentMethod,
  type PhraseCategory,
  type QuestionKind,
} from "@/engine/types";
import { konbini } from "./index";

/** 콘텐츠 린트: 엔진이 전제하는 데이터 불변식을 검사한다. */

/** 질문 종류가 처음 등장하는 레벨 (이 레벨 이하의 정답 문구가 반드시 하나 있어야 한다) */
const KIND_MIN_LEVEL: Record<QuestionKind, number> = {
  WARM: 1,
  BAG: 1,
  CHOPSTICKS: 1,
  TOTAL: 1,
  PAY: 1,
  POINT_CARD: 2,
  SEPARATE_BAG: 2,
  SPOON: 2,
  STRAW: 2,
  CAUTION_HOT: 2,
  AGE_CHECK: 3,
};

const CATEGORIES: PhraseCategory[] = [
  "age",
  "point",
  "temperature",
  "bag",
  "utensil",
  "amount",
  "payment",
  "caution",
  "greeting",
  "service",
];

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  }
  return [...dups];
}

describe("KONBINI 콘텐츠 린트", () => {
  const { items, phrases, regulars, manager, ranks, shifts, replies, hints, confusedReplies, leaveReplies } = konbini;

  describe("상품", () => {
    it("28개 이상, id 는 유일", () => {
      expect(items.length).toBeGreaterThanOrEqual(28);
      expect(duplicates(items.map((i) => i.id))).toEqual([]);
    });

    it("태그는 ITEM_TAGS 에 있는 값만, 중복 없음", () => {
      for (const item of items) {
        for (const tag of item.tags) expect(ITEM_TAGS).toContain(tag);
        expect(duplicates(item.tags)).toEqual([]);
      }
    });

    it("레벨 1 상품은 hot / chopsticks 태그만 쓴다", () => {
      const allowed: ItemTag[] = ["hot", "chopsticks"];
      for (const item of items.filter((i) => i.level === 1)) {
        for (const tag of item.tags) expect(allowed).toContain(tag);
      }
    });

    it("레벨 1~3 에 모두 상품이 있고, 가격은 양의 정수", () => {
      for (const level of [1, 2, 3]) {
        expect(items.some((i) => i.level === level)).toBe(true);
      }
      for (const item of items) {
        expect(Number.isInteger(item.price)).toBe(true);
        expect(item.price).toBeGreaterThan(0);
      }
    });

    it("visual 색은 hex", () => {
      const hex = /^#[0-9A-Fa-f]{6}$/;
      for (const item of items) {
        expect(item.visual.color).toMatch(hex);
        if (item.visual.accent) expect(item.visual.accent).toMatch(hex);
      }
    });
  });

  describe("접객 문구", () => {
    it("id 유일, ja 중복 없음", () => {
      expect(duplicates(phrases.map((p) => p.id))).toEqual([]);
      expect(duplicates(phrases.map((p) => p.ja))).toEqual([]);
    });

    it("모든 질문 종류에 정답 문구가 있고, 첫 등장 레벨에 하나 이상 있다", () => {
      for (const kind of QUESTION_ORDER) {
        const correct = phrases.filter((p) => p.kind === kind);
        expect(correct.length, kind).toBeGreaterThanOrEqual(1);
        const minLevel = Math.min(...correct.map((p) => p.level));
        expect(minLevel, `${kind} min level`).toBeLessThanOrEqual(KIND_MIN_LEVEL[kind]);
      }
    });

    it("PAY 는 결제수단별 정답이 정확히 하나", () => {
      const pay = phrases.filter((p) => p.kind === "PAY");
      for (const method of PAYMENT_METHODS) {
        expect(pay.filter((p) => p.payment === method).length, method).toBe(1);
      }
      expect(pay.every((p) => p.payment !== undefined)).toBe(true);
      // payment 는 PAY 문구에만 붙는다
      expect(phrases.filter((p) => p.kind !== "PAY" && p.payment !== undefined)).toEqual([]);
    });

    it("TOTAL 은 {total} 템플릿 하나", () => {
      const total = phrases.filter((p) => p.kind === "TOTAL");
      expect(total.length).toBe(1);
      expect(total[0].ja).toContain("{total}");
      expect(total[0].ko).toContain("{total}");
      // 다른 문구는 {total} 을 쓰지 않는다 (엔진이 TOTAL 에서만 치환)
      expect(phrases.filter((p) => p.kind !== "TOTAL" && p.ja.includes("{total}"))).toEqual([]);
    });

    it("카테고리마다 문구가 2개 이상 (근접 오답 생성용)", () => {
      for (const category of CATEGORIES) {
        expect(phrases.filter((p) => p.category === category).length, category).toBeGreaterThanOrEqual(2);
      }
    });

    it("오답 전용 문구는 stage 를 가지며, 카테고리별 2개 이상", () => {
      const distractors = phrases.filter((p) => p.kind === null);
      expect(distractors.length).toBeGreaterThanOrEqual(10);
      for (const p of distractors) expect(p.stage, p.id).toBeDefined();
      for (const category of CATEGORIES) {
        expect(distractors.filter((p) => p.category === category).length, category).toBeGreaterThanOrEqual(2);
      }
      expect(distractors.some((p) => p.stage === "GREETING")).toBe(true);
      expect(distractors.some((p) => p.stage === "THANKS")).toBe(true);
    });

    it("레벨은 1~4, 한자가 있으면 reading 이 있다", () => {
      const kanji = /[一-龯]/;
      for (const p of phrases) {
        expect(p.level).toBeGreaterThanOrEqual(1);
        expect(p.level).toBeLessThanOrEqual(4);
        if (kanji.test(p.ja)) expect(p.reading, p.id).toBeDefined();
      }
    });
  });

  describe("레귤러", () => {
    it("정확히 12명, id 유일", () => {
      expect(regulars.length).toBe(12);
      expect(duplicates(regulars.map((r) => r.id))).toEqual([]);
    });

    it("구매 패턴의 상품은 모두 존재한다", () => {
      const ids = new Set(items.map((i) => i.id));
      for (const r of regulars) {
        for (const itemId of r.purchase) expect(ids.has(itemId), `${r.id}: ${itemId}`).toBe(true);
      }
    });

    it("대사 5줄, 호감도 1..5 각각 하나", () => {
      for (const r of regulars) {
        expect(r.lines.length, r.id).toBe(5);
        expect(r.lines.map((l) => l.affinity).sort()).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it("처음 들은 말 2~3개, 시간대 1개 이상, 결제수단 유효", () => {
      for (const r of regulars) {
        expect(r.firstWords.length, r.id).toBeGreaterThanOrEqual(2);
        expect(r.firstWords.length, r.id).toBeLessThanOrEqual(3);
        expect(r.slots.length, r.id).toBeGreaterThanOrEqual(1);
        expect(PAYMENT_METHODS).toContain<PaymentMethod>(r.payment);
      }
    });

    it("해금 조건: 저녁 시프트 2명(저녁·심야), 선배 승급 1명, 12월 시즌 1명", () => {
      const slotUnlocks = regulars.filter((r) => r.unlock.type === "slot");
      expect(slotUnlocks.length).toBe(2);
      expect(regulars.filter((r) => r.unlock.type === "rank").length).toBe(1);
      const season = regulars.filter((r) => r.unlock.type === "season");
      expect(season.length).toBe(1);
      expect(season[0].unlock).toMatchObject({ month: 12 });
    });
  });

  describe("점장", () => {
    it("모든 순간에 3줄 이상, 홈은 시간대별로 1줄 이상", () => {
      for (const when of ["home", "shift_end_good", "shift_end_mid", "shift_end_bad", "absent"] as const) {
        expect(manager.filter((m) => m.when === when).length, when).toBeGreaterThanOrEqual(3);
      }
      for (const slot of SHIFT_SLOTS) {
        expect(manager.filter((m) => m.when === "home" && m.slot === slot).length, slot).toBeGreaterThanOrEqual(1);
      }
    });

    it("디자인 시안 문구를 포함한다", () => {
      expect(manager.some((m) => m.when === "home" && m.slot === "hiru" && m.ja === "昼は混むぞ。袋の質問、忘れるなよ。")).toBe(true);
      expect(manager.some((m) => m.when === "shift_end_good" && m.ja === "よくやった。明日は鈴木さんが来るぞ。")).toBe(true);
      expect(manager.some((m) => m.when === "absent" && m.ja === "昨日どうした？")).toBe(true);
    });
  });

  describe("시프트·직급", () => {
    it("3개 시간대 모두 있고 slot 이 키와 일치", () => {
      for (const slot of SHIFT_SLOTS) {
        expect(shifts[slot].slot).toBe(slot);
        for (const tag of shifts[slot].activeTags) expect(ITEM_TAGS).toContain(tag);
        expect(shifts[slot].itemsPerCustomer[0]).toBeLessThanOrEqual(shifts[slot].itemsPerCustomer[1]);
      }
    });

    it("직급은 6개, 필요 시프트 수 오름차순, 신입은 0", () => {
      expect(ranks.length).toBe(6);
      expect(ranks[0].shiftsRequired).toBe(0);
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i].shiftsRequired).toBeGreaterThan(ranks[i - 1].shiftsRequired);
      }
      expect(ranks.find((r) => r.id === "senpai")?.unlocksTags).toEqual(["alcohol", "tobacco"]);
    });
  });

  describe("손님 응답", () => {
    it("모든 질문 종류에 응답 3개 이상과 힌트가 있다", () => {
      for (const kind of QUESTION_ORDER) {
        expect(replies[kind].length, kind).toBeGreaterThanOrEqual(3);
        expect(hints[kind], kind).toBeDefined();
      }
    });

    it("당황·이탈 대사가 3개 이상", () => {
      expect(confusedReplies.length).toBeGreaterThanOrEqual(3);
      expect(leaveReplies.length).toBeGreaterThanOrEqual(3);
    });
  });
});
