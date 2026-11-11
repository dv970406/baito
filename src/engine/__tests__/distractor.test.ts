import { describe, expect, it } from "vitest";
import {
  buildOptions,
  correctPhraseFor,
  findCorrectPhrase,
  formatYen,
  renderPhrase,
  wrongTotals,
} from "../distractor";
import { createRng } from "../rng";
import type { AnswerOption, Phrase, QuestionStep } from "../types";
import { CONTENT, customerOf, ITEMS } from "./fixtures";

function build(step: QuestionStep, customer = customerOf([ITEMS.bento, ITEMS.ice]), level = 1, seed = 1) {
  return buildOptions(step, {
    content: CONTENT,
    customer,
    queue: ["WARM", "BAG", "CHOPSTICKS", "TOTAL", "PAY"],
    level,
    rng: createRng(seed),
  });
}

function assertWellFormed(options: AnswerOption[]): void {
  expect(options).toHaveLength(4);
  expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
  expect(new Set(options.map((o) => o.ja)).size).toBe(4);
  expect(new Set(options.map((o) => o.phraseId)).size).toBe(4);
}

describe("correctPhraseFor", () => {
  it("kind 와 레벨에 맞는 문구", () => {
    const c = customerOf([ITEMS.bento]);
    expect(correctPhraseFor("WARM", c, CONTENT, 1).id).toBe("warm");
  });

  it("PAY 는 결제 수단별 정답", () => {
    expect(correctPhraseFor("PAY", customerOf([ITEMS.gum], { payment: "qr" }), CONTENT, 1).id).toBe("pay.qr");
    expect(correctPhraseFor("PAY", customerOf([ITEMS.gum], { payment: "credit" }), CONTENT, 1).id).toBe(
      "pay.credit",
    );
  });

  it("레벨이 부족하면 없음(findCorrectPhrase undefined, correctPhraseFor 예외)", () => {
    const c = customerOf([ITEMS.beer]);
    expect(findCorrectPhrase("AGE_CHECK", c, CONTENT, 2)).toBeUndefined();
    expect(() => correctPhraseFor("AGE_CHECK", c, CONTENT, 2)).toThrow();
    expect(findCorrectPhrase("AGE_CHECK", c, CONTENT, 3)?.id).toBe("age");
  });
});

describe("renderPhrase / formatYen", () => {
  it("천 단위 구분자", () => {
    expect(formatYen(1280)).toBe("1,280");
    expect(formatYen(130)).toBe("130");
    expect(formatYen(1234567)).toBe("1,234,567");
  });

  it("{total} 을 금액+円 으로 치환", () => {
    const total = CONTENT.phrases.find((p) => p.id === "total")!;
    const r = renderPhrase(total, customerOf([ITEMS.bento, ITEMS.ice])); // 498 + 180 = 678
    expect(r.ja).toBe("合計で 678円です");
    expect(r.ko).toBe("합계 678엔입니다");
  });

  it("템플릿에 이미 円 이 있으면 숫자만 넣는다", () => {
    const phrase: Phrase = { id: "x", kind: "TOTAL", category: "amount", ja: "{total}円になります", ko: "{total}엔입니다", level: 1 };
    const r = renderPhrase(phrase, customerOf([ITEMS.bento, ITEMS.bento, ITEMS.bento])); // 1494
    expect(r.ja).toBe("1,494円になります");
    expect(r.ko).toBe("1,494엔입니다");
  });

  it("플레이스홀더가 없으면 그대로", () => {
    const warm = CONTENT.phrases.find((p) => p.id === "warm")!;
    expect(renderPhrase(warm, customerOf([ITEMS.bento])).ja).toBe("温めますか？");
  });
});

describe("wrongTotals", () => {
  it("정답과 다른 서로 다른 금액 3개", () => {
    for (const total of [678, 1280, 100, 1111, 5]) {
      const wrong = wrongTotals(total);
      expect(wrong).toHaveLength(3);
      expect(new Set(wrong).size).toBe(3);
      for (const w of wrong) {
        expect(w).not.toBe(total);
        expect(w).toBeGreaterThan(0);
      }
    }
  });

  it("자릿수 뒤바꿈이 포함된다", () => {
    expect(wrongTotals(1280)).toContain(2180);
  });
});

describe("buildOptions", () => {
  it("4개, 정답 1개, ja 모두 다름", () => {
    assertWellFormed(build({ kind: "WARM", correctPhraseId: "warm" }));
    assertWellFormed(build({ kind: "BAG", correctPhraseId: "bag" }));
    assertWellFormed(build({ kind: "CHOPSTICKS", correctPhraseId: "chop" }));
  });

  it("정답 선택지의 phraseId 는 step.correctPhraseId", () => {
    const options = build({ kind: "WARM", correctPhraseId: "warm" });
    expect(options.find((o) => o.isCorrect)?.phraseId).toBe("warm");
  });

  it("같은 seed 는 같은 선택지", () => {
    const step: QuestionStep = { kind: "WARM", correctPhraseId: "warm" };
    expect(build(step, undefined, 1, 9)).toEqual(build(step, undefined, 1, 9));
  });

  it("WARM 의 근접 오답 冷やしますか？ 와 조합 오답(스푼 — 장바구니에 spoon 없음)이 포함된다", () => {
    const options = build({ kind: "WARM", correctPhraseId: "warm" }, customerOf([ITEMS.bento, ITEMS.ice]));
    const ids = options.map((o) => o.phraseId);
    expect(ids).toContain("d.cool");
    // 조합 오답은 spoon/fork(둘 다 spoon 태그) 중 하나
    expect(ids.some((id) => id === "spoon" || id === "d.fork")).toBe(true);
  });

  it("레벨보다 높은 문구는 오답으로 쓰지 않는다", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const options = build({ kind: "WARM", correctPhraseId: "warm" }, undefined, 1, seed);
      const ids = options.map((o) => o.phraseId);
      expect(ids).not.toContain("straw");
      expect(ids).not.toContain("age");
      expect(ids).not.toContain("caution");
      expect(ids).not.toContain("point");
      expect(ids).not.toContain("sepbag");
    }
  });

  it("PAY 는 다른 결제 수단 3개가 오답", () => {
    const customer = customerOf([ITEMS.gum], { payment: "ic" });
    const options = build({ kind: "PAY", correctPhraseId: "pay.ic" }, customer);
    assertWellFormed(options);
    expect(options.map((o) => o.phraseId).sort()).toEqual(["pay.cash", "pay.credit", "pay.ic", "pay.qr"]);
    expect(options.find((o) => o.isCorrect)?.phraseId).toBe("pay.ic");
  });

  it("TOTAL 은 틀린 금액 3개를 합성하고 정답과 다르다", () => {
    const customer = customerOf([ITEMS.bento, ITEMS.ice]); // 678
    const options = build({ kind: "TOTAL", correctPhraseId: "total" }, customer);
    assertWellFormed(options);
    const correct = options.find((o) => o.isCorrect)!;
    expect(correct.ja).toBe("合計で 678円です");
    const wrong = options.filter((o) => !o.isCorrect);
    expect(wrong.map((o) => o.phraseId).sort()).toEqual(["total.wrong.1", "total.wrong.2", "total.wrong.3"]);
    for (const w of wrong) {
      expect(w.ja).toMatch(/^合計で [\d,]+円です$/);
      expect(w.ja).not.toBe(correct.ja);
    }
  });

  it("TOTAL 큰 금액도 천 단위 구분", () => {
    const customer = customerOf([ITEMS.bento, ITEMS.bento, ITEMS.cigarettes]); // 1596
    const options = build({ kind: "TOTAL", correctPhraseId: "total" }, customer, 3);
    expect(options.find((o) => o.isCorrect)?.ja).toBe("合計で 1,596円です");
  });

  it("같은 kind 의 다른 변형(또 다른 정답)은 오답으로 쓰지 않는다", () => {
    const variant: Phrase = { id: "warm2", kind: "WARM", category: "temperature", ja: "こちら温めますか？", ko: "이거 데울까요?", level: 1 };
    const content = { ...CONTENT, phrases: [...CONTENT.phrases, variant] };
    for (let seed = 1; seed <= 30; seed++) {
      const options = buildOptions(
        { kind: "WARM", correctPhraseId: "warm" },
        { content, customer: customerOf([ITEMS.bento]), queue: ["WARM", "TOTAL", "PAY"], level: 1, rng: createRng(seed) },
      );
      expect(options.map((o) => o.phraseId)).not.toContain("warm2");
      expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });
});
