import { describe, expect, it } from "vitest";
import {
  availableShiftSlots,
  bumpAffinity,
  computeWageDelta,
  dayDiff,
  isRegularUnlocked,
  nextShiftSlot,
  rankFor,
  unlockedTags,
  updateStreak,
  WAGE_FLOOR,
} from "../progression";
import type { StreakInput } from "../progression";
import type { Regular } from "../types";
import { CONTENT, REGULARS } from "./fixtures";

describe("computeWageDelta", () => {
  const zero = { perfects: 0, goods: 0, oks: 0, lates: 0, wrongs: 0, missed: 0, maxCombo: 0, firstSuccessTags: [] };

  it("공식대로 계산", () => {
    expect(computeWageDelta({ ...zero, perfects: 3, goods: 2, oks: 1, maxCombo: 4, wrongs: 2 })).toBe(
      12 + 4 + 1 + 8 - 2,
    );
    expect(computeWageDelta({ ...zero, lates: 10 })).toBe(0);
    expect(computeWageDelta({ ...zero, firstSuccessTags: ["hot"] })).toBe(40);
    // 말하기 모드 보너스: 1회당 +3, 생략하면 0
    expect(computeWageDelta({ ...zero, spokens: 2 })).toBe(6);
  });

  it("[-80, 160] 클램프", () => {
    expect(computeWageDelta({ ...zero, missed: 10 })).toBe(-80);
    expect(computeWageDelta({ ...zero, perfects: 100 })).toBe(160);
    expect(WAGE_FLOOR).toBe(900);
  });
});

describe("rankFor / unlockedTags", () => {
  const ranks = CONTENT.ranks;

  it("누적 시프트로 직급을 고른다", () => {
    expect(rankFor(0, ranks).current.id).toBe("shinjin");
    expect(rankFor(2, ranks).current.id).toBe("shinjin");
    expect(rankFor(3, ranks).current.id).toBe("ippan");
    expect(rankFor(7, ranks).current.id).toBe("senpai");
    expect(rankFor(999, ranks).current.id).toBe("tencho");
  });

  it("다음 직급까지의 진행도", () => {
    const p = rankFor(1, ranks);
    expect(p.next?.id).toBe("ippan");
    expect(p.shiftsToNext).toBe(2);
    expect(p.progress).toBeCloseTo(1 / 3);

    const top = rankFor(30, ranks);
    expect(top.next).toBeNull();
    expect(top.shiftsToNext).toBe(0);
    expect(top.progress).toBe(1);
  });

  it("정렬되지 않은 입력도 처리", () => {
    const shuffled = ranks.slice().reverse();
    expect(rankFor(5, shuffled).current.id).toBe("ippan");
  });

  it("해금 태그는 도달 직급들의 합집합", () => {
    expect(unlockedTags(0, ranks)).toEqual([]);
    expect(unlockedTags(3, ranks)).toEqual(["alcohol"]);
    expect(unlockedTags(7, ranks).sort()).toEqual(["alcohol", "tobacco"]);
  });
});

describe("dayDiff", () => {
  it("UTC 기준 일수 차이", () => {
    expect(dayDiff("2026-01-01", "2026-01-02")).toBe(1);
    expect(dayDiff("2026-01-31", "2026-02-01")).toBe(1);
    expect(dayDiff("2026-02-28", "2026-03-01")).toBe(1); // 평년
    expect(dayDiff("2024-02-28", "2024-03-01")).toBe(2); // 윤년
    expect(dayDiff("2026-03-10", "2026-03-10")).toBe(0);
    expect(dayDiff("2026-03-10", "2026-03-08")).toBe(-2);
    expect(dayDiff("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("updateStreak", () => {
  const base: StreakInput = { streak: 5, lastPlayDate: "2026-03-10", leavesLeft: 2, leaveMonth: "2026-03" };

  it("첫 출근 → 1", () => {
    const s = updateStreak({ streak: 0, lastPlayDate: null, leavesLeft: 2, leaveMonth: "2026-03" }, "2026-03-10");
    expect(s.streak).toBe(1);
    expect(s.lastPlayDate).toBe("2026-03-10");
  });

  it("같은 날 → 변화 없음", () => {
    expect(updateStreak(base, "2026-03-10")).toEqual(base);
  });

  it("어제 출근 → +1", () => {
    const s = updateStreak(base, "2026-03-11");
    expect(s.streak).toBe(6);
    expect(s.leavesLeft).toBe(2);
    expect(s.lastPlayDate).toBe("2026-03-11");
  });

  it("하루 빠짐 + 휴가 있음 → 휴가 소비, +1", () => {
    const s = updateStreak(base, "2026-03-12");
    expect(s.streak).toBe(6);
    expect(s.leavesLeft).toBe(1);
  });

  it("하루 빠짐 + 휴가 없음 → 리셋", () => {
    const s = updateStreak({ ...base, leavesLeft: 0 }, "2026-03-12");
    expect(s.streak).toBe(1);
    expect(s.leavesLeft).toBe(0);
  });

  it("이틀 이상 빠짐 → 리셋 (휴가 있어도)", () => {
    const s = updateStreak(base, "2026-03-13");
    expect(s.streak).toBe(1);
    expect(s.leavesLeft).toBe(2);
  });

  it("달이 바뀌면 휴가가 2로 리셋된 뒤 적용된다", () => {
    const march = { streak: 9, lastPlayDate: "2026-03-30", leavesLeft: 0, leaveMonth: "2026-03" };
    const s = updateStreak(march, "2026-04-01"); // 하루(3/31) 빠짐
    expect(s.leaveMonth).toBe("2026-04");
    expect(s.streak).toBe(10);
    expect(s.leavesLeft).toBe(1);
  });
});

describe("bumpAffinity", () => {
  it("하루에 한 번만 +1, 최대 5", () => {
    const s0 = { affinity: 0, metCount: 0, lastMetDate: null, firstWordsHeard: [] };
    const s1 = bumpAffinity(s0, "2026-03-10");
    expect(s1).toEqual({ affinity: 1, metCount: 1, lastMetDate: "2026-03-10", firstWordsHeard: [] });
    const s2 = bumpAffinity(s1, "2026-03-10");
    expect(s2.affinity).toBe(1);
    expect(s2.metCount).toBe(2);
    const s3 = bumpAffinity({ ...s2, affinity: 5 }, "2026-03-11");
    expect(s3.affinity).toBe(5);
    expect(s3.lastMetDate).toBe("2026-03-11");
  });
});

describe("isRegularUnlocked", () => {
  const ranks = CONTENT.ranks;
  const ctx = { rank: "ippan" as const, slot: "asa" as const, month: 4, ranks };
  const withUnlock = (unlock: Regular["unlock"]): Regular => ({ ...REGULARS[0], unlock });

  it("open 은 항상", () => {
    expect(isRegularUnlocked(withUnlock({ type: "open" }), ctx)).toBe(true);
  });
  it("slot 은 그 시간대일 때만", () => {
    expect(isRegularUnlocked(withUnlock({ type: "slot", slot: "asa", label: "" }), ctx)).toBe(true);
    expect(isRegularUnlocked(withUnlock({ type: "slot", slot: "yoru", label: "" }), ctx)).toBe(false);
  });
  it("rank 는 현재 직급이 요구 직급 이상일 때", () => {
    expect(isRegularUnlocked(withUnlock({ type: "rank", rank: "shinjin", label: "" }), ctx)).toBe(true);
    expect(isRegularUnlocked(withUnlock({ type: "rank", rank: "ippan", label: "" }), ctx)).toBe(true);
    expect(isRegularUnlocked(withUnlock({ type: "rank", rank: "senpai", label: "" }), ctx)).toBe(false);
  });
  it("season 은 그 달에만", () => {
    expect(isRegularUnlocked(withUnlock({ type: "season", month: 4, label: "" }), ctx)).toBe(true);
    expect(isRegularUnlocked(withUnlock({ type: "season", month: 12, label: "" }), ctx)).toBe(false);
  });
});

describe("availableShiftSlots / nextShiftSlot", () => {
  const today = "2026-03-10";

  it("asa 는 항상, 완료 순서대로 열린다", () => {
    expect(availableShiftSlots({ date: today, completed: [] }, today)).toEqual(["asa"]);
    expect(availableShiftSlots({ date: today, completed: ["asa"] }, today)).toEqual(["asa", "hiru"]);
    expect(availableShiftSlots({ date: today, completed: ["asa", "hiru"] }, today)).toEqual(["asa", "hiru", "yoru"]);
  });

  it("다른 날짜의 진행은 무시", () => {
    expect(availableShiftSlots({ date: "2026-03-09", completed: ["asa", "hiru"] }, today)).toEqual(["asa"]);
    expect(nextShiftSlot({ date: "2026-03-09", completed: ["asa", "hiru", "yoru"] }, today)).toBe("asa");
  });

  it("nextShiftSlot 은 첫 미완료 슬롯, 다 끝나면 null", () => {
    expect(nextShiftSlot({ date: today, completed: [] }, today)).toBe("asa");
    expect(nextShiftSlot({ date: today, completed: ["asa"] }, today)).toBe("hiru");
    expect(nextShiftSlot({ date: today, completed: ["asa", "hiru"] }, today)).toBe("yoru");
    expect(nextShiftSlot({ date: today, completed: ["asa", "hiru", "yoru"] }, today)).toBeNull();
  });
});
