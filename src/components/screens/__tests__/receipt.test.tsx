// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftSummary } from "@/engine/types";
import { konbini } from "@/content";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { LAST_RECEIPT_KEY } from "@/components/game/shiftModel";
import { ReceiptScreen } from "../ReceiptScreen";
import { managerMoment, pickManagerLine } from "../receiptModel";

const { shareMock } = vi.hoisted(() => ({ shareMock: vi.fn() }));
vi.mock("@/lib/share", () => ({ shareText: shareMock }));

/* ───────────────────────── 픽스처 ───────────────────────── */

function summaryOf(over: Partial<ShiftSummary> = {}): ShiftSummary {
  return {
    workplaceId: "konbini",
    slot: "hiru",
    level: 2,
    playedAt: "2026-11-10T04:30:00.000Z",
    durationMs: 200_000,
    served: 9,
    missed: 1,
    questionCount: 20,
    perfects: 12,
    goods: 4,
    oks: 1,
    lates: 2,
    wrongs: 1,
    maxCombo: 11,
    hardest: { phraseId: "straw.1", kind: "STRAW", wrongCount: 0, lateCount: 2 },
    wageDelta: 40,
    wageAfter: 1170,
    firstSuccessTags: ["straw"],
    regularsMet: ["yamamoto"],
    endedBy: "customers",
    answers: [],
    ...over,
  };
}

const LATEST = summaryOf();
const OLDER = summaryOf({
  slot: "asa",
  playedAt: "2026-11-09T22:10:00.000Z",
  served: 8,
  missed: 0,
  perfects: 3,
  goods: 5,
  oks: 4,
  lates: 2,
  wrongs: 6,
  maxCombo: 4,
  hardest: null,
  wageDelta: -12,
  wageAfter: 1130,
  firstSuccessTags: [],
  regularsMet: [],
});

beforeEach(() => {
  shareMock.mockReset();
  shareMock.mockResolvedValue("copied");
  window.sessionStorage.clear();
  const profile = { ...createDefaultProfile(), name: "하루", wage: 1170, totalShifts: 12 };
  useGameStore.setState({ hydrated: true, profile, sessions: [LATEST, OLDER], pendingSessions: [] });
});

afterEach(cleanup);

/* ───────────────────────── 테스트 ───────────────────────── */

describe("ReceiptScreen", () => {
  it("가장 최근 영수증의 머리·행·시급·헷갈린 한마디·점장 한마디를 보여준다", () => {
    render(<ReceiptScreen />);
    const paper = screen.getByLabelText("마감 영수증");
    const text = paper.textContent ?? "";

    expect(text).toContain(konbini.storeNameJa);
    expect(text).toContain(`${konbini.storeBranchJa} · ${konbini.registerLabel}`);
    expect(text).toContain("昼シフト 11:30–14:00");
    expect(text).toContain("担当 하루");
    expect(text).toContain("9名 / 10");
    expect(text).toContain("1名");
    expect(text).toContain("×11");
    expect(text).toContain("¥1,170");
    expect(text).toContain("¥1,130 → ¥1,170");
    expect(text).toContain("+¥40");
    // 속도 등급 4칸
    expect(within(paper).getByText("Perfect").nextElementSibling?.textContent).toBe("12");
    expect(within(paper).getByText("Late").nextElementSibling?.textContent).toBe("2");

    const straw = konbini.phrases.find((p) => p.id === "straw.1");
    expect(straw).toBeTruthy();
    expect(text).toContain(straw?.ja ?? "");
    expect(text).toContain("2번 늦게");
    // 처음 성공 태그 · 만난 단골
    expect(within(paper).getByLabelText("처음 성공한 상품 종류").textContent).toContain("吸");
    expect(text).toContain("山本");
    // 점장 한마디 — (12+4)/20 = 0.8 → good, playedAt 으로 결정
    expect(managerMoment(LATEST)).toBe("shift_end_good");
    const line = pickManagerLine(konbini, LATEST);
    expect(line?.when).toBe("shift_end_good");
    expect(text).toContain(line?.ja ?? "");
    expect(text).toContain("DAY 12");
    // 학습 UI 어휘 금지
    expect(text).not.toMatch(/진도율|JLPT|공부|학습/);

    // 하단: 탭바 + 액션
    expect(screen.getByRole("navigation", { name: "주 메뉴" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "영수증" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "다음 시프트" }).getAttribute("href")).toBe("/konbini");
  });

  it("공유 버튼은 shareText 를 부르고 결과 토스트를 띄운다", async () => {
    render(<ReceiptScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /영수증 공유/ }));
    });
    expect(shareMock).toHaveBeenCalledTimes(1);
    const arg = shareMock.mock.calls[0][0] as { title: string; text: string };
    expect(arg.text).toContain("昼シフト");
    expect(arg.text).toContain("¥1,170");
    expect(screen.getByText("복사됐어요")).toBeTruthy();

    shareMock.mockResolvedValue("shared");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /영수증 공유/ }));
    });
    expect(screen.getByText("공유했어요")).toBeTruthy();
  });

  it("지난 영수증을 펼쳐 고르면 그 영수증으로 바뀐다", () => {
    render(<ReceiptScreen />);
    const toggle = screen.getByRole("button", { name: /지난 영수증 1장/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    const rows = within(screen.getByLabelText("지난 영수증")).getAllByRole("button", { pressed: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("−¥12");
    fireEvent.click(rows[0]);

    const paper = screen.getByLabelText("마감 영수증");
    const text = paper.textContent ?? "";
    expect(text).toContain("朝シフト 07:00–10:00");
    expect(text).toContain("8名 / 8");
    expect(text).toContain("¥1,130");
    expect(text).toContain("−¥12");
    expect(text).toContain("なし");
    expect(text).toContain("DAY 11");
    // (3+5)/20 = 0.4 → bad
    expect(managerMoment(OLDER)).toBe("shift_end_bad");
  });

  it("스토어가 비어도 sessionStorage 사본이 있으면 그 영수증을 보여준다", () => {
    useGameStore.setState({ sessions: [] });
    window.sessionStorage.setItem(LAST_RECEIPT_KEY, JSON.stringify(LATEST));
    render(<ReceiptScreen />);
    expect(screen.getByLabelText("마감 영수증").textContent).toContain("¥1,170");
    expect(screen.queryByText("아직 영수증이 없어요.")).toBeNull();
  });

  it("영수증이 하나도 없으면 빈 상태와 출근 CTA", () => {
    useGameStore.setState({ sessions: [] });
    render(<ReceiptScreen />);
    expect(screen.getByText("아직 영수증이 없어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /出勤する/ }).getAttribute("href")).toBe("/konbini");
    expect(screen.queryByRole("button", { name: /영수증 공유/ })).toBeNull();
  });

  it("복원 전엔 스켈레톤", () => {
    useGameStore.setState({ hydrated: false });
    render(<ReceiptScreen />);
    expect(screen.getByText(/영수증을 꺼내는 중/)).toBeTruthy();
    expect(screen.queryByLabelText("마감 영수증")).toBeNull();
  });
});
