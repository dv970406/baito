import { describe, expect, it } from "vitest";
import { cap, capPair, isCaptionLang } from "../caption";

describe("caption", () => {
  it("en 이면 영어, 영어가 비면 한국어로 돌아간다", () => {
    expect(cap({ ko: "봉투", en: "Bag" }, "en")).toBe("Bag");
    expect(cap({ ko: "봉투" }, "en")).toBe("봉투");
    expect(cap({ ko: "봉투", en: "" }, "en")).toBe("봉투");
    expect(cap({ ko: "봉투", en: "Bag" }, "ko")).toBe("봉투");
    expect(capPair("아침", "Morning", "en")).toBe("Morning");
    expect(capPair("아침", undefined, "en")).toBe("아침");
  });

  it("알 수 없는 값은 언어로 인정하지 않는다", () => {
    expect(isCaptionLang("ko")).toBe(true);
    expect(isCaptionLang("en")).toBe(true);
    expect(isCaptionLang("ja")).toBe(false);
    expect(isCaptionLang(undefined)).toBe(false);
  });
});
