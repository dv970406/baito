import { describe, expect, it } from "vitest";
import { tagSetKey } from "../cartResolver";
import { createRng } from "../rng";
import {
  applyAnswerToWeights,
  effectiveActiveTags,
  eligibleItems,
  generateCustomer,
  initialTagWeights,
  RANK_GATED_TAGS,
  WEIGHT_CAP,
  WEIGHT_FLOOR,
} from "../scheduler";
import { ITEM_TAGS } from "../types";
import type { GenerateContext, PaymentMethod } from "../index";
import { CONTENT, REGULARS, SHIFTS } from "./fixtures";

function ctx(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return {
    content: CONTENT,
    config: SHIFTS.asa,
    index: 0,
    rng: createRng(1),
    tagWeights: initialTagWeights(),
    recentTagSets: [],
    pendingRetryTags: [],
    regularsAvailable: [],
    regularsAlreadyMet: [],
    ...overrides,
  };
}

describe("tag weights", () => {
  it("초기값은 전부 1", () => {
    const w = initialTagWeights();
    for (const tag of ITEM_TAGS) expect(w[tag]).toBe(1);
  });

  it("perfect ×0.6, correct ×0.9, wrong ×2.5", () => {
    const w = initialTagWeights();
    expect(applyAnswerToWeights(w, "hot", "perfect").hot).toBeCloseTo(0.6);
    expect(applyAnswerToWeights(w, "hot", "correct").hot).toBeCloseTo(0.9);
    expect(applyAnswerToWeights(w, "hot", "wrong").hot).toBeCloseTo(2.5);
    // 원본 불변, 다른 태그 불변
    expect(w.hot).toBe(1);
    expect(applyAnswerToWeights(w, "hot", "wrong").cold).toBe(1);
  });

  it("클램프 [0.2, 8]", () => {
    let w = initialTagWeights();
    for (let i = 0; i < 20; i++) w = applyAnswerToWeights(w, "straw", "perfect");
    expect(w.straw).toBe(WEIGHT_FLOOR);
    for (let i = 0; i < 20; i++) w = applyAnswerToWeights(w, "straw", "wrong");
    expect(w.straw).toBe(WEIGHT_CAP);
  });

  it("tag 가 undefined 면 변화 없는 복사본", () => {
    const w = initialTagWeights();
    const next = applyAnswerToWeights(w, undefined, "wrong");
    expect(next).toEqual(w);
    expect(next).not.toBe(w);
  });
});

describe("effectiveActiveTags", () => {
  it("해금되지 않은 alcohol/tobacco 를 제거한다", () => {
    expect(RANK_GATED_TAGS).toEqual(["alcohol", "tobacco"]);
    expect(effectiveActiveTags(SHIFTS.yoru, [])).not.toContain("alcohol");
    expect(effectiveActiveTags(SHIFTS.yoru, [])).not.toContain("tobacco");
    expect(effectiveActiveTags(SHIFTS.yoru, ["alcohol"])).toContain("alcohol");
    expect(effectiveActiveTags(SHIFTS.yoru, ["alcohol"])).not.toContain("tobacco");
    expect(effectiveActiveTags(SHIFTS.yoru, [])).toContain("hot");
  });
});

describe("generateCustomer", () => {
  it("레벨·활성 태그에 맞는 상품만 등장 (태그 없는 상품은 항상 가능)", () => {
    const eligible = eligibleItems(CONTENT.items, 1, ["hot"]);
    expect(eligible.map((i) => i.id).sort()).toEqual(["gum", "onigiri", "water"]);

    for (let seed = 0; seed < 50; seed++) {
      const c = generateCustomer(ctx({ rng: createRng(seed) }));
      for (const item of c.items) {
        expect(item.level).toBeLessThanOrEqual(1);
        for (const tag of item.tags) expect(SHIFTS.asa.activeTags).toContain(tag);
      }
      expect(c.items.length).toBeGreaterThanOrEqual(1);
      expect(c.items.length).toBeLessThanOrEqual(3);
      expect(c.total).toBe(c.items.reduce((s, i) => s + i.price, 0));
      expect(c.patienceMax).toBe(4);
      expect(c.regularId).toBeNull();
    }
  });

  it("activeTags 덮어쓰기(해금 반영)가 config 보다 우선한다", () => {
    for (let seed = 0; seed < 30; seed++) {
      const c = generateCustomer(ctx({ config: SHIFTS.yoru, rng: createRng(seed), activeTags: ["hot"] }));
      for (const item of c.items) expect(item.tags.every((t) => t === "hot")).toBe(true);
    }
  });

  it("seed 가 같으면 같은 손님", () => {
    const a = generateCustomer(ctx({ rng: createRng(123) }));
    const b = generateCustomer(ctx({ rng: createRng(123) }));
    expect(a).toEqual(b);
  });

  it("pendingRetryTags 의 태그가 첫 상품에 반드시 포함된다", () => {
    for (let seed = 0; seed < 40; seed++) {
      const c = generateCustomer(ctx({ rng: createRng(seed), pendingRetryTags: ["spoon"] }));
      expect(c.items[0].tags).toContain("spoon");
    }
  });

  it("recentTagSets 와 겹치는 조합을 피한다", () => {
    // 가능한 조합을 대부분 금지하고 남은 하나만 허용 — "cold|spoon"(pudding 단독) 은 금지하지 않는다
    const forbidden = ["", "hot", "cold", "chopsticks|hot", "cold|hot", "chopsticks|cold|hot", "chopsticks|cold|hot|spoon", "cold|hot|spoon", "chopsticks|hot|spoon", "hot|spoon"];
    let avoided = 0;
    for (let seed = 0; seed < 60; seed++) {
      const c = generateCustomer(ctx({ rng: createRng(seed), recentTagSets: forbidden }));
      if (!forbidden.includes(tagSetKey(c.tagSet))) avoided++;
    }
    // 12번 재시도로 대부분 회피된다
    expect(avoided).toBeGreaterThan(50);
  });

  it("레귤러가 뽑히면 고정 구매 패턴과 결제 수단을 쓴다", () => {
    const c = generateCustomer(
      ctx({ rng: createRng(1), regularsAvailable: REGULARS, regularChance: 1 }),
    );
    expect(c.regularId).toBe("tanaka"); // yui 는 yoru 전용이라 asa 에서는 후보가 아니다
    expect(c.items.map((i) => i.id)).toEqual(["onigiri", "water"]);
    expect(c.payment).toBe("ic");
    expect(c.patienceMax).toBe(5); // patienceBonus 1
    expect(c.total).toBe(240);
  });

  it("이미 만난 레귤러는 다시 나오지 않는다", () => {
    const c = generateCustomer(
      ctx({ rng: createRng(1), regularsAvailable: REGULARS, regularChance: 1, regularsAlreadyMet: ["tanaka"] }),
    );
    expect(c.regularId).toBeNull();
  });

  it("regularChance 0 이면 레귤러가 나오지 않는다", () => {
    for (let seed = 0; seed < 20; seed++) {
      const c = generateCustomer(ctx({ rng: createRng(seed), regularsAvailable: REGULARS, regularChance: 0 }));
      expect(c.regularId).toBeNull();
    }
  });

  it("레귤러 구매 패턴이 전부 비적격이면 무작위 상품으로 대체", () => {
    const regular = { ...REGULARS[0], purchase: ["beer"] }; // 레벨 3 상품 → asa 에서는 없음
    const c = generateCustomer(ctx({ rng: createRng(2), regularsAvailable: [regular], regularChance: 1 }));
    expect(c.regularId).toBe("tanaka");
    expect(c.items.length).toBeGreaterThan(0);
    expect(c.items.map((i) => i.id)).not.toContain("beer");
  });

  it("익명 결제 수단 분포가 대략 4:3:2:1", () => {
    const counts: Record<PaymentMethod, number> = { cash: 0, ic: 0, qr: 0, credit: 0 };
    const n = 3000;
    for (let seed = 0; seed < n; seed++) counts[generateCustomer(ctx({ rng: createRng(seed) })).payment]++;
    expect(counts.cash / n).toBeGreaterThan(0.35);
    expect(counts.cash / n).toBeLessThan(0.45);
    expect(counts.ic / n).toBeGreaterThan(0.25);
    expect(counts.ic / n).toBeLessThan(0.35);
    expect(counts.qr / n).toBeGreaterThan(0.15);
    expect(counts.qr / n).toBeLessThan(0.25);
    expect(counts.credit / n).toBeGreaterThan(0.06);
    expect(counts.credit / n).toBeLessThan(0.14);
  });

  it("가중치가 높은 태그의 상품이 더 자주 나온다", () => {
    const heavy = { ...initialTagWeights(), spoon: 8 };
    let withSpoonHeavy = 0;
    let withSpoonFlat = 0;
    for (let seed = 0; seed < 300; seed++) {
      if (generateCustomer(ctx({ rng: createRng(seed), tagWeights: heavy })).tagSet.includes("spoon")) withSpoonHeavy++;
      if (generateCustomer(ctx({ rng: createRng(seed) })).tagSet.includes("spoon")) withSpoonFlat++;
    }
    expect(withSpoonHeavy).toBeGreaterThan(withSpoonFlat);
  });

  it("등장 가능한 상품이 없으면 예외", () => {
    const content = { ...CONTENT, items: [CONTENT.items.find((i) => i.id === "beer")!] };
    expect(() => generateCustomer(ctx({ content }))).toThrow();
  });
});
