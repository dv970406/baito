// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { HomeScreen, optionalLockReason, pickManagerLine, pickSeasonNotice } from "../HomeScreen";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { localYmd } from "@/store/date";
import { konbiniManager } from "@/content/konbini/manager";
import { konbiniRanks, konbiniShifts } from "@/content/konbini/shifts";
import { weekStartOf } from "@/engine/progression";
import type { Season, ShiftSummary } from "@/engine/types";

/** 이번 달 시즌 공지 — 콘텐츠와 무관하게 홈 카드 렌더를 검증하기 위해 extras 만 바꿔 끼운다 (vi.mock 은 호이스팅되므로 hoisted 로) */
const { TEST_SEASON } = vi.hoisted(() => {
  const season: Season = {
    month: new Date().getMonth() + 1,
    nameJa: "テスト月間",
    nameKo: "테스트 달",
    posterJa: "テスト",
    noticeJa: "今月からレジ袋は有料です。",
    noticeKo: "이번 달부터 봉투는 유료예요",
    rule: { kind: "bagSize" },
  };
  return { TEST_SEASON: season };
});
vi.mock("@/content/konbini/extras", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/konbini/extras")>();
  return { ...actual, konbiniSeasons: [TEST_SEASON] };
});

/** next/link 를 평범한 <a> 로 대체 (Next 전용 prop 은 DOM 으로 흘리지 않음) */
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const anchor: Record<string, unknown> = { ...rest };
    for (const key of ["prefetch", "scroll", "replace"]) delete anchor[key];
    return (
      <a href={href} {...anchor}>
        {children}
      </a>
    );
  },
}));

const today = localYmd();

function resetStore() {
  useGameStore.setState({
    hydrated: false,
    profile: createDefaultProfile(),
    sessions: [],
    pendingSessions: [],
  });
}

function hydrateWith(patch: Partial<ReturnType<typeof createDefaultProfile>>, sessions: ShiftSummary[] = []) {
  useGameStore.setState({
    hydrated: true,
    profile: { ...createDefaultProfile(), ...patch },
    sessions,
  });
}

function fakeSession(slot: ShiftSummary["slot"], extra: Partial<ShiftSummary> = {}): ShiftSummary {
  return {
    workplaceId: "konbini",
    slot,
    level: 1,
    playedAt: new Date().toISOString(),
    durationMs: 180_000,
    served: 11,
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
    wageDelta: 40,
    wageAfter: 1040,
    firstSuccessTags: [],
    regularsMet: [],
    endedBy: "time",
    answers: [],
    ...extra,
  };
}

beforeEach(resetStore);
afterEach(cleanup);

describe("HomeScreen · 스켈레톤", () => {
  it("복원 전에는 시프트 링크·이름·시급을 그리지 않고 CTA 가 비활성이다", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("banner").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText(/알바생 알바생|알바생$/)).toBeNull();
    expect(screen.queryByText("¥1,000")).toBeNull();
    // 시프트 행 세 개는 자리만 잡고 링크는 없다
    const shiftLinks = screen.queryAllByRole("link", { name: /시프트 출근/ });
    expect(shiftLinks).toHaveLength(0);
    const cta = screen.getByRole("button", { name: "출근하기" });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    // 탭바는 항상 있다
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeTruthy();
  });
});

describe("HomeScreen · 복원 후", () => {
  it("이름·시급·직급·연속 출근을 보여준다", () => {
    hydrateWith({ name: "성준", wage: 1130, totalShifts: 4, rank: "ippan", streak: 12 });
    render(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("성준 알바생");
    expect(screen.getByText("¥1,130")).toBeTruthy();
    // totalShifts 4 → 一般(일반 알바), 선배(10)까지 6회
    expect(screen.getByText("一般")).toBeTruthy();
    expect(screen.getByText(/일반 알바 · 승급까지 6회/)).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("マルマート 神田南口店", { exact: false })).toBeTruthy();
  });

  it("아무것도 안 했으면 아침이 출근 링크, 점심·저녁은 잠김(링크 없음)", () => {
    hydrateWith({});
    render(<HomeScreen />);
    const asa = screen.getByRole("link", { name: /아침 시프트 출근/ });
    expect(asa.getAttribute("href")).toBe("/konbini/shift/asa");
    expect(screen.queryByRole("link", { name: /점심 시프트 출근/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /저녁 시프트 출근/ })).toBeNull();
    expect(screen.getByText("아침 시프트 후 열림")).toBeTruthy();
    expect(screen.getByText("점심 시프트 후 열림")).toBeTruthy();
    // 점심·저녁 + 추가 시프트(심야)
    expect(screen.getAllByRole("img", { name: "잠김" }).length).toBeGreaterThanOrEqual(2);
    // 하단 CTA 는 다음 시프트(朝)로
    const cta = screen.getByRole("link", { name: /출근하기 · 朝/ });
    expect(cta.getAttribute("href")).toBe("/konbini/shift/asa");
  });

  it("아침을 끝냈으면 아침은 완료 표시, 점심이 출근 링크, 저녁은 잠김", () => {
    hydrateWith(
      { today: { date: today, completed: ["asa"] }, lastPlayDate: today, totalShifts: 1, streak: 1 },
      [fakeSession("asa")],
    );
    render(<HomeScreen />);
    expect(screen.getByRole("img", { name: "완료" })).toBeTruthy();
    expect(screen.getByText("완료 · 손님 11명 · 최고 콤보 ×9")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /아침 시프트 출근/ })).toBeNull();
    const hiru = screen.getByRole("link", { name: /점심 시프트 출근/ });
    expect(hiru.getAttribute("href")).toBe("/konbini/shift/hiru");
    expect(screen.queryByRole("link", { name: /저녁 시프트 출근/ })).toBeNull();
    expect(screen.getByRole("link", { name: /출근하기 · 昼/ }).getAttribute("href")).toBe("/konbini/shift/hiru");
  });

  it("승급 시험 세션은 같은 시간대 행의 완료 기록으로 쓰지 않는다", () => {
    hydrateWith(
      { today: { date: today, completed: ["asa"] }, lastPlayDate: today, totalShifts: 2, rank: "ippan" },
      [
        fakeSession("asa", { served: 8, maxCombo: 25, exam: { rank: "ippan", comboRequired: 6, passed: true } }),
        fakeSession("asa"),
      ],
    );
    render(<HomeScreen />);
    expect(screen.getByText("완료 · 손님 11명 · 최고 콤보 ×9")).toBeTruthy();
    expect(screen.queryByText(/최고 콤보 ×25/)).toBeNull();
  });

  it("셋 다 끝냈으면 마감 상태와 비활성 CTA 를 보여준다", () => {
    hydrateWith({ today: { date: today, completed: ["asa", "hiru", "yoru"] }, lastPlayDate: today, totalShifts: 2 });
    render(<HomeScreen />);
    expect(screen.getByText("오늘 마감 — 내일 또 봐요")).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /시프트 출근/ })).toHaveLength(0);
    const cta = screen.getByRole("button", { name: "오늘 마감" });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    // 점장은 shift_end_good 대사
    const note = screen.getByLabelText("점장 메모");
    const goodJa = konbiniManager.filter((l) => l.when === "shift_end_good").map((l) => l.ja);
    const shown = within(note).getByText((_, el) => el?.getAttribute("lang") === "ja" && goodJa.includes(el.textContent ?? ""));
    expect(shown).toBeTruthy();
  });

  it("단골 요약·다음 직급·말하기 모드(잠김)를 보여주고 도감으로 링크한다", () => {
    hydrateWith({
      totalShifts: 4,
      rank: "ippan",
      regulars: {
        tanaka: { affinity: 1, metCount: 2, lastMetDate: today, firstWordsHeard: [] },
        suzuki: { affinity: 0, metCount: 0, lastMetDate: null, firstWordsHeard: [] },
      },
    });
    render(<HomeScreen />);
    const regularsLink = screen.getByRole("link", { name: "단골 도감 보기" });
    expect(regularsLink.getAttribute("href")).toBe("/konbini/regulars");
    expect(regularsLink.textContent).toContain("1");
    expect(regularsLink.textContent).toMatch(/\/ \d+/);
    expect(screen.getByText(/다음 직급/).textContent).toContain("先輩");
    expect(screen.getByRole("progressbar", { name: "다음 직급까지 진행" })).toBeTruthy();
    expect(screen.getByText(/선배부터 전 시프트|음성 인식을 지원하지 않아요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "직장 바꾸기 · BAITO 이력서" }).getAttribute("href")).toBe("/");
  });

  it("이번 달 시즌 공지가 있으면 점장 메모 아래 「今月のお知らせ」 카드", () => {
    hydrateWith({});
    render(<HomeScreen />);
    const notice = screen.getByLabelText("이번 달 공지");
    expect(within(notice).getByText("今月からレジ袋は有料です。")).toBeTruthy();
    expect(within(notice).getByText("이번 달부터 봉투는 유료예요")).toBeTruthy();
    expect(within(notice).getByText("テスト月間")).toBeTruthy();
  });
});

describe("HomeScreen · 심야 시프트", () => {
  it("신입이면 심야 행은 잠김 + 「先輩から」 이유", () => {
    hydrateWith({ today: { date: today, completed: ["asa", "hiru", "yoru"] }, lastPlayDate: today, totalShifts: 2 });
    render(<HomeScreen />);
    expect(screen.queryByRole("link", { name: /심야 시프트 출근/ })).toBeNull();
    expect(screen.getByText("先輩から")).toBeTruthy();
    expect(screen.getByText(/선배부터 열려요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "오늘 마감" })).toBeTruthy();
  });

  it("선배인데 기본 시프트가 남았으면 '3 시프트 후 열림'", () => {
    hydrateWith({ rank: "senpai", totalShifts: 12 });
    render(<HomeScreen />);
    expect(screen.queryByRole("link", { name: /심야 시프트 출근/ })).toBeNull();
    expect(screen.getByText("3 시프트 후 열림")).toBeTruthy();
  });

  it("선배가 셋 다 끝내면 심야가 출근 링크, CTA 는 深夜 출근", () => {
    hydrateWith({
      rank: "senpai",
      totalShifts: 12,
      today: { date: today, completed: ["asa", "hiru", "yoru"] },
      lastPlayDate: today,
    });
    render(<HomeScreen />);
    const shinya = screen.getByRole("link", { name: /심야 시프트 출근/ });
    expect(shinya.getAttribute("href")).toBe("/konbini/shift/shinya");
    expect(screen.queryByText("오늘 마감 — 내일 또 봐요")).toBeNull();
    const cta = screen.getByRole("link", { name: /深夜 출근/ });
    expect(cta.getAttribute("href")).toBe("/konbini/shift/shinya");
  });

  it("심야까지 끝냈으면 완료 표시와 마감 CTA", () => {
    hydrateWith({
      rank: "senpai",
      totalShifts: 13,
      today: { date: today, completed: ["asa", "hiru", "yoru", "shinya"] },
      lastPlayDate: today,
    });
    render(<HomeScreen />);
    expect(screen.getAllByRole("img", { name: "완료" })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "오늘 마감" })).toBeTruthy();
  });
});

describe("HomeScreen · 승급 시험 카드", () => {
  it("시프트 수를 채웠고 이번 주에 안 봤으면 「店長点検」 출근 카드 + 점장 점검 예고", () => {
    hydrateWith({ totalShifts: 3, rank: "shinjin", examWeek: null, lastPlayDate: today });
    render(<HomeScreen />);
    const card = screen.getByRole("link", { name: /점장 점검 시프트 출근 · 일반 알바 승급/ });
    expect(card.getAttribute("href")).toBe("/konbini/shift/exam");
    expect(card.textContent).toContain("店長点検");
    expect(card.textContent).toContain("一般");
    expect(card.textContent).toContain("콤보 ×6 · 이탈 0");
    expect(screen.queryByRole("progressbar", { name: "다음 직급까지 진행" })).toBeNull();
    expect(screen.getByText(/점장 점검 대기/)).toBeTruthy();
    // 점장 메모는 exam_ready
    const note = screen.getByLabelText("점장 메모");
    const readyJa = konbiniManager.filter((l) => l.when === "exam_ready").map((l) => l.ja);
    expect(within(note).getByText((_, el) => el?.getAttribute("lang") === "ja" && readyJa.includes(el.textContent ?? ""))).toBeTruthy();
  });

  it("이번 주에 이미 봤으면 비활성 카드 '이번 주 점검 완료 · 다음 주 월요일'", () => {
    hydrateWith({ totalShifts: 3, rank: "shinjin", examWeek: weekStartOf(today), lastPlayDate: today });
    render(<HomeScreen />);
    expect(screen.queryByRole("link", { name: /점장 점검 시프트 출근/ })).toBeNull();
    const card = screen.getByTestId("exam-card");
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.textContent).toContain("이번 주 점검 완료 · 다음 주 월요일");
    // 시험이 막혀 있으면 점장 메모는 평소 대사
    const note = screen.getByLabelText("점장 메모");
    const readyJa = konbiniManager.filter((l) => l.when === "exam_ready").map((l) => l.ja);
    expect(within(note).queryByText((_, el) => el?.getAttribute("lang") === "ja" && readyJa.includes(el.textContent ?? ""))).toBeNull();
  });

  it("아직 못 채웠으면 진행바 카드", () => {
    hydrateWith({ totalShifts: 1, rank: "shinjin" });
    render(<HomeScreen />);
    expect(screen.queryByTestId("exam-card")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "다음 직급까지 진행" })).toBeTruthy();
    expect(screen.getByText("2회 남음")).toBeTruthy();
  });
});

describe("순수 헬퍼", () => {
  it("pickSeasonNotice — 빈 배열·공지 없는 달은 null", () => {
    expect(pickSeasonNotice([], 12)).toBeNull();
    expect(pickSeasonNotice([{ ...TEST_SEASON, noticeJa: undefined, noticeKo: undefined }], TEST_SEASON.month)).toBeNull();
    expect(pickSeasonNotice([TEST_SEASON], TEST_SEASON.month)?.noticeJa).toBe("今月からレジ袋は有料です。");
    expect(pickSeasonNotice([TEST_SEASON], (TEST_SEASON.month % 12) + 1)).toBeNull();
  });

  it("optionalLockReason — 직급 부족이면 「先輩から」, 아니면 세 시프트 후", () => {
    expect(optionalLockReason(konbiniShifts.shinya, "shinjin", konbiniRanks)).toEqual({ ja: "先輩から", ko: "선배부터 열려요" });
    expect(optionalLockReason(konbiniShifts.shinya, "leader", konbiniRanks).ko).toBe("3 시프트 후 열림");
    expect(optionalLockReason(konbiniShifts.asa, "shinjin", konbiniRanks).ko).toBe("3 시프트 후 열림");
  });
});

describe("pickManagerLine", () => {
  it("이틀 이상 비웠으면 결근 대사, 같은 날짜면 같은 줄", () => {
    const a = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-08", nextSlot: "asa" });
    const b = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-08", nextSlot: "asa" });
    expect(a?.when).toBe("absent");
    expect(a).toEqual(b);
  });

  it("어제 출근했으면 다음 시프트 시간대의 홈 대사", () => {
    const line = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-09", nextSlot: "hiru" });
    expect(line?.when).toBe("home");
    expect(line?.slot).toBe("hiru");
  });

  it("첫 출근(lastPlayDate 없음)은 결근으로 보지 않는다", () => {
    const line = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: null, nextSlot: "asa" });
    expect(line?.when).toBe("home");
  });

  it("셋 다 끝났으면 shift_end_good", () => {
    const line = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-10", nextSlot: null });
    expect(line?.when).toBe("shift_end_good");
  });

  it("시험을 볼 수 있으면 exam_ready 가 홈·마감 대사보다 우선, 결근은 그보다 우선", () => {
    const ready = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-09", nextSlot: "asa", examAvailable: true });
    expect(ready?.when).toBe("exam_ready");
    const closed = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-10", nextSlot: null, examAvailable: true });
    expect(closed?.when).toBe("exam_ready");
    const absent = pickManagerLine(konbiniManager, { today: "2026-11-10", lastPlayDate: "2026-11-07", nextSlot: "asa", examAvailable: true });
    expect(absent?.when).toBe("absent");
  });
});
