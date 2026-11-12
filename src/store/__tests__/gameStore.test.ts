/**
 * 세이브 스토어의 순수 부분 — 시프트 결과 반영(applyShiftToProfile)과 구 세이브 정규화.
 * 승급 시험(점장 점검)은 시프트 표의 칸을 채우지 않고, 합격해야만 직급이 오른다.
 */
import { describe, expect, it } from "vitest";
import type { ShiftSummary } from "@/engine/types";
import { initialTagWeights } from "@/engine/scheduler";
import { normalizeProfile } from "@/shared/player";
import { applyShiftToProfile, createDefaultProfile } from "../gameStore";

const TODAY = "2026-11-11"; // 수요일 → 주 시작 2026-11-09

function summaryOf(extra: Partial<ShiftSummary> = {}): ShiftSummary {
  return {
    workplaceId: "konbini",
    slot: "asa",
    level: 1,
    playedAt: `${TODAY}T09:00:00.000Z`,
    durationMs: 180_000,
    served: 10,
    missed: 0,
    questionCount: 20,
    perfects: 10,
    goods: 6,
    oks: 3,
    lates: 1,
    wrongs: 0,
    maxCombo: 9,
    spokens: 0,
    exam: null,
    events: 0,
    hardest: null,
    wageDelta: 30,
    wageAfter: 1030,
    firstSuccessTags: [],
    regularsMet: [],
    endedBy: "time",
    answers: [],
    ...extra,
  };
}

function apply(profilePatch: Partial<ReturnType<typeof createDefaultProfile>>, summary: ShiftSummary) {
  return applyShiftToProfile(
    { ...createDefaultProfile(), ...profilePatch },
    { summary, tagWeights: initialTagWeights(), regularsMet: summary.regularsMet, wordsHeard: {}, today: TODAY },
  );
}

describe("applyShiftToProfile · 일반 시프트", () => {
  it("시급·누적 시프트·오늘 완료 칸이 반영되고 직급은 바뀌지 않는다", () => {
    const next = apply({ totalShifts: 9, rank: "ippan" }, summaryOf());
    expect(next.wage).toBe(1030);
    expect(next.totalShifts).toBe(10);
    expect(next.today).toEqual({ date: TODAY, completed: ["asa"] });
    expect(next.rank).toBe("ippan");
    expect(next.examWeek).toBeNull();
  });

  it("같은 칸을 다시 플레이해도 완료 목록은 한 번만", () => {
    const next = apply({ today: { date: TODAY, completed: ["asa"] } }, summaryOf());
    expect(next.today.completed).toEqual(["asa"]);
  });
});

describe("applyShiftToProfile · 승급 시험", () => {
  const passed = summaryOf({ slot: "hiru", exam: { rank: "senpai", comboRequired: 10, passed: true }, maxCombo: 12 });
  const failed = summaryOf({ slot: "hiru", exam: { rank: "senpai", comboRequired: 10, passed: false }, missed: 1 });

  it("합격이면 직급이 오르고 이번 주(월요일)로 응시 기록이 남는다", () => {
    const next = apply({ rank: "ippan", totalShifts: 10 }, passed);
    expect(next.rank).toBe("senpai");
    expect(next.examWeek).toBe("2026-11-09");
  });

  it("불합격이면 직급은 그대로지만 이번 주 응시 기록은 남는다(주 1회)", () => {
    const next = apply({ rank: "ippan", totalShifts: 10 }, failed);
    expect(next.rank).toBe("ippan");
    expect(next.examWeek).toBe("2026-11-09");
  });

  it("시험은 오늘 시프트 표의 칸을 채우지 않는다(추가 근무)", () => {
    const next = apply({ rank: "ippan", today: { date: TODAY, completed: ["asa"] } }, passed);
    expect(next.today.completed).toEqual(["asa"]);
    // 누적 시프트 수는 센다
    expect(next.totalShifts).toBe(1);
  });
});

describe("normalizeProfile · 구 세이브", () => {
  it("rank 가 없는 세이브는 누적 시프트 수로 직급을 추정한다", () => {
    expect(normalizeProfile({ totalShifts: 0 }).rank).toBe("shinjin");
    expect(normalizeProfile({ totalShifts: 4 }).rank).toBe("ippan");
    expect(normalizeProfile({ totalShifts: 12 }).rank).toBe("senpai");
    expect(normalizeProfile({ totalShifts: 12 }).examWeek).toBeNull();
  });

  it("rank 가 있으면 누적 시프트 수와 무관하게 그대로 둔다(시험 제도)", () => {
    expect(normalizeProfile({ totalShifts: 40, rank: "ippan" }).rank).toBe("ippan");
  });

  it("알 수 없는 rank 값은 추정으로 대체한다", () => {
    const raw = { totalShifts: 4, rank: "boss" } as unknown as Parameters<typeof normalizeProfile>[0];
    expect(normalizeProfile(raw).rank).toBe("ippan");
  });
});

