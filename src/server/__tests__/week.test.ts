import { describe, expect, it } from "vitest";
import { weekRangeFor } from "../week";

describe("weekRangeFor (JST 월요일 기준)", () => {
  it("수요일(JST) 은 같은 주 월요일 00:00 JST 로 내려간다", () => {
    // 2026-11-11(수) 12:00 JST = 03:00Z
    const r = weekRangeFor(new Date("2026-11-11T03:00:00Z"));
    expect(r.label).toBe("2026-11-09");
    // 월요일 00:00 JST = 일요일 15:00Z
    expect(r.start.toISOString()).toBe("2026-11-08T15:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-15T15:00:00.000Z");
  });

  it("UTC 로는 일요일 밤이지만 JST 로는 월요일 새벽이면 새 주가 시작된다", () => {
    // 2026-11-08(일) 16:00Z = 11-09(월) 01:00 JST
    const r = weekRangeFor(new Date("2026-11-08T16:00:00Z"));
    expect(r.label).toBe("2026-11-09");
  });

  it("월요일 00:00 JST 직전은 지난주에 속한다", () => {
    // 2026-11-08(일) 14:59:59Z = 11-08(일) 23:59:59 JST
    const r = weekRangeFor(new Date("2026-11-08T14:59:59Z"));
    expect(r.label).toBe("2026-11-02");
    expect(r.end.toISOString()).toBe("2026-11-08T15:00:00.000Z");
  });

  it("일요일(JST) 은 그 주 월요일에 속한다", () => {
    // 2026-11-15(일) 23:00 JST = 14:00Z
    const r = weekRangeFor(new Date("2026-11-15T14:00:00Z"));
    expect(r.label).toBe("2026-11-09");
  });

  it("구간 길이는 정확히 7일", () => {
    const r = weekRangeFor(new Date());
    expect(r.end.getTime() - r.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(r.start.getTime()).toBeLessThanOrEqual(Date.now());
    expect(r.end.getTime()).toBeGreaterThan(Date.now());
  });
});
