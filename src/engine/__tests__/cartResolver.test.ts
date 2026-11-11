import { describe, expect, it } from "vitest";
import { resolveCart, tagSetKey, tagSetOf } from "../cartResolver";
import { QUESTION_ORDER } from "../types";
import type { ItemTag } from "../types";
import { ITEMS } from "./fixtures";

const ALL: ItemTag[] = ["hot", "cold", "chopsticks", "spoon", "straw", "alcohol", "tobacco", "fragile_hot"];

describe("tagSetOf / tagSetKey", () => {
  it("정렬된 중복 없는 태그 집합", () => {
    expect(tagSetOf([ITEMS.bento, ITEMS.onigiri, ITEMS.ice])).toEqual(["hot", "cold", "chopsticks"]);
    expect(tagSetKey(["hot", "cold", "hot"])).toBe("cold|hot");
    expect(tagSetKey([])).toBe("");
  });
});

describe("resolveCart", () => {
  it("상품 1개(hot) → WARM, TOTAL, PAY — BAG 없음", () => {
    expect(resolveCart([ITEMS.onigiri], { level: 1, activeTags: ALL, pointCard: false })).toEqual([
      "WARM",
      "TOTAL",
      "PAY",
    ]);
  });

  it("상품 2개 이상이면 BAG, 접객 순서대로 정렬", () => {
    const kinds = resolveCart([ITEMS.bento, ITEMS.pudding], { level: 2, activeTags: ALL, pointCard: true });
    expect(kinds).toEqual(["POINT_CARD", "WARM", "SEPARATE_BAG", "BAG", "CHOPSTICKS", "SPOON", "TOTAL", "PAY"]);
    const idx = kinds.map((k) => QUESTION_ORDER.indexOf(k));
    expect(idx).toEqual(idx.slice().sort((a, b) => a - b));
  });

  it("hot+cold 는 레벨 1 에서 SEPARATE_BAG 없음, 레벨 2 부터 있음", () => {
    const cart = [ITEMS.onigiri, ITEMS.ice];
    expect(resolveCart(cart, { level: 1, activeTags: ALL, pointCard: false })).not.toContain("SEPARATE_BAG");
    expect(resolveCart(cart, { level: 2, activeTags: ALL, pointCard: false })).toContain("SEPARATE_BAG");
  });

  it("hot+cold 라도 cold 가 비활성이면 SEPARATE_BAG 없음", () => {
    expect(
      resolveCart([ITEMS.onigiri, ITEMS.ice], { level: 2, activeTags: ["hot"], pointCard: false }),
    ).not.toContain("SEPARATE_BAG");
  });

  it("alcohol 이 activeTags 에 없으면 AGE_CHECK 없음", () => {
    const cart = [ITEMS.beer];
    expect(resolveCart(cart, { level: 3, activeTags: ["hot"], pointCard: false })).not.toContain("AGE_CHECK");
    expect(resolveCart(cart, { level: 3, activeTags: ["alcohol"], pointCard: false })).toContain("AGE_CHECK");
    // tobacco 도 AGE_CHECK 를 낸다
    expect(resolveCart([ITEMS.cigarettes], { level: 3, activeTags: ["tobacco"], pointCard: false })).toContain(
      "AGE_CHECK",
    );
  });

  it("비활성 태그는 질문을 내지 않는다 (straw, fragile_hot)", () => {
    const cart = [ITEMS.teaPack, ITEMS.hotCoffee];
    expect(resolveCart(cart, { level: 2, activeTags: [], pointCard: false })).toEqual(["BAG", "TOTAL", "PAY"]);
    expect(resolveCart(cart, { level: 2, activeTags: ["straw", "fragile_hot"], pointCard: false })).toEqual([
      "BAG",
      "STRAW",
      "TOTAL",
      "PAY",
      "CAUTION_HOT",
    ]);
  });

  it("pointCard 플래그가 POINT_CARD 를 맨 앞(연령확인 뒤)에 넣는다", () => {
    const kinds = resolveCart([ITEMS.beer, ITEMS.gum], { level: 3, activeTags: ALL, pointCard: true });
    expect(kinds.slice(0, 2)).toEqual(["AGE_CHECK", "POINT_CARD"]);
  });

  it("TOTAL 과 PAY 는 항상 포함", () => {
    expect(resolveCart([ITEMS.gum], { level: 1, activeTags: [], pointCard: false })).toEqual(["TOTAL", "PAY"]);
  });
});
