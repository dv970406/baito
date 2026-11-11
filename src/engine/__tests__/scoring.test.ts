import { describe, expect, it } from "vitest";
import { comboMultiplier, gradeSpeed, PATIENCE_MAX, PERFECT_MS } from "../scoring";

describe("gradeSpeed (제한 6000ms)", () => {
  const limit = 6000;
  it("경계값", () => {
    expect(gradeSpeed(0, limit)).toBe("perfect");
    expect(gradeSpeed(PERFECT_MS, limit)).toBe("perfect");
    expect(gradeSpeed(PERFECT_MS + 1, limit)).toBe("good");
    expect(gradeSpeed(2400, limit)).toBe("good"); // 40%
    expect(gradeSpeed(2401, limit)).toBe("ok");
    expect(gradeSpeed(4500, limit)).toBe("ok"); // 75%
    expect(gradeSpeed(4501, limit)).toBe("late");
    expect(gradeSpeed(6000, limit)).toBe("late");
  });

  it("제한 시간이 짧아도 perfect 는 1500ms 고정", () => {
    expect(gradeSpeed(1500, 3000)).toBe("perfect");
    expect(gradeSpeed(1501, 3000)).toBe("ok"); // 40% = 1200 < 1501 ≤ 2250
    expect(gradeSpeed(2251, 3000)).toBe("late");
  });

  it("상수", () => {
    expect(PATIENCE_MAX).toBe(4);
    expect(PERFECT_MS).toBe(1500);
  });
});

describe("comboMultiplier", () => {
  it("5마다 0.25 씩, 최대 2", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.25);
    expect(comboMultiplier(9)).toBe(1.25);
    expect(comboMultiplier(10)).toBe(1.5);
    expect(comboMultiplier(20)).toBe(2);
    expect(comboMultiplier(100)).toBe(2);
    expect(comboMultiplier(-3)).toBe(1);
  });
});
