import { describe, expect, it } from "vitest";
import {
  MINUS,
  formatDateJa,
  formatDateYmd,
  formatReceiptDate,
  formatTimeHm,
  formatYen,
  formatYenDelta,
  todayYmd,
} from "../format";

describe("formatYen", () => {
  it("천 단위 구분자를 넣는다", () => {
    expect(formatYen(1170)).toBe("¥1,170");
    expect(formatYen(598)).toBe("¥598");
    expect(formatYen(1234567)).toBe("¥1,234,567");
    expect(formatYen(0)).toBe("¥0");
  });
  it("음수는 U+2212 마이너스를 쓴다", () => {
    expect(formatYen(-25)).toBe(`${MINUS}¥25`);
  });
});

describe("formatYenDelta", () => {
  it("부호를 붙인다", () => {
    expect(formatYenDelta(40)).toBe("+¥40");
    expect(formatYenDelta(-25)).toBe("−¥25");
    expect(formatYenDelta(0)).toBe("±¥0");
  });
});

describe("날짜/시각", () => {
  const d = new Date(2026, 10, 10, 7, 12); // 2026-11-10 (화) 07:12 로컬
  it("formatDateJa → 11月9日（月）", () => {
    expect(formatDateJa(new Date(2026, 10, 9))).toBe("11月9日（月）");
    expect(formatDateJa(d)).toBe("11月10日（火）");
    expect(formatDateJa(new Date(2026, 0, 4))).toBe("1月4日（日）");
  });
  it("formatDateYmd 는 로컬 기준 YYYY-MM-DD", () => {
    expect(formatDateYmd(d)).toBe("2026-11-10");
    expect(formatDateYmd(new Date(2026, 0, 4, 0, 30))).toBe("2026-01-04");
  });
  it("todayYmd 는 오늘과 같다", () => {
    expect(todayYmd()).toBe(formatDateYmd(new Date()));
  });
  it("formatTimeHm → 07:12", () => {
    expect(formatTimeHm(d)).toBe("07:12");
  });
  it("formatReceiptDate → 2026/11/10 昼シフト 11:30–14:00", () => {
    expect(formatReceiptDate(d.toISOString(), "昼", "11:30–14:00")).toBe("2026/11/10 昼シフト 11:30–14:00");
  });
  it("formatReceiptDate 는 잘못된 ISO 도 앞 10자로 버틴다", () => {
    expect(formatReceiptDate("2026-11-10Tgarbage", "朝", "07:00–10:00")).toBe("2026/11/10 朝シフト 07:00–10:00");
  });
});

describe("자막 언어별 날짜", () => {
  it("formatMonth — ko 「12월」 · en 「December」", async () => {
    const { formatMonth } = await import("../format");
    expect(formatMonth(12)).toBe("12월");
    expect(formatMonth(12, "en")).toBe("December");
    expect(formatMonth(13, "en")).toBe("13");
  });

  it("formatShortDate — ko 「11/10」 · en 「Nov 10」", async () => {
    const { formatShortDate } = await import("../format");
    const d = new Date(2026, 10, 10);
    expect(formatShortDate(d)).toBe("11/10");
    expect(formatShortDate(d, "en")).toBe("Nov 10");
  });
});
