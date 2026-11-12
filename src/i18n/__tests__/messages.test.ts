import { describe, expect, it } from "vitest";
import { MESSAGES, en, format, ko, translate } from "../messages";
import { cap, capPair } from "../caption";

describe("화면 문구 사전", () => {
  it("ko 와 en 의 키가 정확히 같다", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort());
  });

  it("빈 문자열이 없다", () => {
    for (const [lang, dict] of Object.entries(MESSAGES)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${lang}:${key}`).not.toBe("");
      }
    }
  });

  it("두 언어의 보간 자리표시가 같다", () => {
    const slots = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(ko) as (keyof typeof ko)[]) {
      expect(slots(en[key]), key).toEqual(slots(ko[key]));
    }
  });

  it("학습 UI 단어가 없다 — ko: 공부/학습/문제/정답, en: study/lesson/quiz/correct answer", () => {
    for (const value of Object.values(ko)) {
      expect(value).not.toMatch(/공부|학습|문제|정답/);
    }
    for (const value of Object.values(en)) {
      expect(value).not.toMatch(/study|lesson|quiz|correct answer/i);
    }
  });

  it("format 은 vars 로 채우고, 없는 자리표시는 그대로 둔다", () => {
    expect(format("{name} 시프트", { name: "아침" })).toBe("아침 시프트");
    expect(format("{a}/{b}", { a: 1 })).toBe("1/{b}");
    expect(format("그대로")).toBe("그대로");
  });

  it("translate 는 언어별 문구를 고른다", () => {
    expect(translate("ko", "common.shiftName", { name: "아침" })).toBe("아침 시프트");
    expect(translate("en", "common.shiftName", { name: "Morning" })).toBe("Morning shift");
  });

  it("cap/capPair — en 이 비면 ko 로 돌아간다", () => {
    expect(cap({ ko: "봉투", en: "Bag" }, "en")).toBe("Bag");
    expect(cap({ ko: "봉투" }, "en")).toBe("봉투");
    expect(cap({ ko: "봉투", en: "Bag" }, "ko")).toBe("봉투");
    expect(capPair("아침", undefined, "en")).toBe("아침");
  });
});
