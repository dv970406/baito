// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftSummary } from "@/engine/types";
import { konbini } from "@/content";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { LAST_RECEIPT_KEY } from "@/components/game/shiftModel";
import { ReceiptScreen } from "../ReceiptScreen";
import { examVerdict, frozenSeconds, hardestLabel, managerMoment, pickManagerLine } from "../receiptModel";

const { shareMock, shareFileMock, receiptPngMock, momentPngMock } = vi.hoisted(() => ({
  shareMock: vi.fn(),
  shareFileMock: vi.fn(),
  receiptPngMock: vi.fn(),
  momentPngMock: vi.fn(),
}));
vi.mock("@/lib/share", () => ({ shareText: shareMock, shareFile: shareFileMock }));
vi.mock("@/lib/image", () => ({ renderReceiptPng: receiptPngMock, renderFrozenMomentPng: momentPngMock }));

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
    spokens: 0,
  exam: null,
  events: 0,
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
  spokens: 0,
  exam: null,
  events: 0,
  hardest: null,
  wageDelta: -12,
  wageAfter: 1130,
  firstSuccessTags: [],
  regularsMet: [],
});

beforeEach(() => {
  shareMock.mockReset();
  shareMock.mockResolvedValue("copied");
  shareFileMock.mockReset();
  shareFileMock.mockResolvedValue("downloaded");
  receiptPngMock.mockReset();
  receiptPngMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  momentPngMock.mockReset();
  momentPngMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
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

  it("승급 시험 합격 영수증은 「店長点検 · 合格」 블록과 새 명찰을 보여준다", () => {
    const passed = summaryOf({ exam: { rank: "ippan", comboRequired: 6, passed: true }, maxCombo: 8, missed: 0 });
    useGameStore.setState({ sessions: [passed] });
    render(<ReceiptScreen />);
    const block = screen.getByTestId("exam-block");
    expect(block.getAttribute("data-passed")).toBe("true");
    expect(block.textContent).toContain("合格");
    expect(block.textContent).not.toContain("不合格");
    expect(block.textContent).toContain("基準 ×6 · 最高 ×8");
    expect(block.textContent).toContain("이탈 0명");
    expect(block.textContent).toContain("一般");
    expect(block.textContent).toContain("일반 알바");
  });

  it("불합격이면 「不合格」 과 다음 주 안내, 시험이 아니면 블록 없음", () => {
    const failed = summaryOf({ exam: { rank: "ippan", comboRequired: 6, passed: false }, maxCombo: 4, missed: 1 });
    useGameStore.setState({ sessions: [failed] });
    render(<ReceiptScreen />);
    const block = screen.getByTestId("exam-block");
    expect(block.getAttribute("data-passed")).toBe("false");
    expect(block.textContent).toContain("不合格");
    expect(block.textContent).toContain("다음 주 월요일");
    expect(block.textContent).not.toContain("새 명찰");
    cleanup();
    useGameStore.setState({ sessions: [LATEST] });
    render(<ReceiptScreen />);
    expect(screen.queryByTestId("exam-block")).toBeNull();
  });

  it("돌발 이벤트를 처리했으면 「突発対応 N件」 행", () => {
    useGameStore.setState({ sessions: [summaryOf({ events: 2 })] });
    render(<ReceiptScreen />);
    const text = screen.getByLabelText("마감 영수증").textContent ?? "";
    expect(text).toContain("突発対応");
    expect(text).toContain("2件");
    cleanup();
    useGameStore.setState({ sessions: [summaryOf({ events: 0 })] });
    render(<ReceiptScreen />);
    expect(screen.getByLabelText("마감 영수증").textContent).not.toContain("突発対応");
  });

  it("합성 id(담배 번호·리스닝)가 hardest 면 고정 라벨로 그린다", () => {
    useGameStore.setState({
      sessions: [
        summaryOf({ hardest: { phraseId: "tobacco.pick.23", kind: "TOBACCO_PICK", wrongCount: 2, lateCount: 0 } }),
        summaryOf({ playedAt: "2026-11-09T04:30:00.000Z", hardest: { phraseId: "listen.BAG", kind: "LISTEN", wrongCount: 1, lateCount: 1 } }),
        summaryOf({ playedAt: "2026-11-08T04:30:00.000Z", hardest: { phraseId: "unknown.id", kind: "BAG", wrongCount: 1, lateCount: 0 } }),
      ],
    });
    render(<ReceiptScreen />);
    let text = screen.getByLabelText("마감 영수증").textContent ?? "";
    expect(text).toContain("タバコの番号");
    expect(text).toContain("담배 번호 매칭 · 2번 다른 말");

    fireEvent.click(screen.getByRole("button", { name: /지난 영수증 2장/ }));
    const rows = within(screen.getByLabelText("지난 영수증")).getAllByRole("button", { pressed: false });
    fireEvent.click(rows[0]);
    text = screen.getByLabelText("마감 영수증").textContent ?? "";
    expect(text).toContain("お客さんの一言");
    expect(text).toContain("손님 요구 듣기 · 1번 다른 말 · 1번 늦게");

    fireEvent.click(within(screen.getByLabelText("지난 영수증")).getAllByRole("button", { pressed: false })[1]);
    text = screen.getByLabelText("마감 영수증").textContent ?? "";
    expect(text).toContain("なし");
  });

  it("「画像を保存」 은 영수증 PNG 를 만들어 shareFile 로 넘기고 결과 토스트", async () => {
    render(<ReceiptScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "영수증 이미지 저장" }));
    });
    expect(receiptPngMock).toHaveBeenCalledTimes(1);
    expect(receiptPngMock.mock.calls[0][0]).toBe(LATEST);
    expect(receiptPngMock.mock.calls[0][3]).toEqual({ day: 12 });
    expect(shareFileMock).toHaveBeenCalledTimes(1);
    const [blob, filename, text] = shareFileMock.mock.calls[0] as [Blob, string, string];
    expect(blob.type).toBe("image/png");
    expect(filename).toBe("baito-receipt-20261110.png");
    expect(text).toContain("昼シフト");
    expect(screen.getByText("이미지를 저장했어요")).toBeTruthy();
  });

  it("캔버스를 못 쓰면 안내 토스트, 공유는 부르지 않는다", async () => {
    receiptPngMock.mockResolvedValue(null);
    render(<ReceiptScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "영수증 이미지 저장" }));
    });
    expect(shareFileMock).not.toHaveBeenCalled();
    expect(screen.getByText("이 브라우저에서는 이미지를 만들 수 없어요")).toBeTruthy();
  });

  it("「この一瞬をシェア」 는 hardest 가 있을 때만 활성, 공유 카드 PNG 를 넘긴다", async () => {
    shareFileMock.mockResolvedValue("shared");
    render(<ReceiptScreen />);
    const button = screen.getByRole("button", { name: "얼어붙은 순간 공유 카드" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(momentPngMock).toHaveBeenCalledWith(LATEST, konbini);
    const [, filename, text] = shareFileMock.mock.calls[0] as [Blob, string, string];
    expect(filename).toBe("baito-moment-20261110.png");
    expect(text).toContain("#BAITO");
    expect(screen.getByText("공유했어요")).toBeTruthy();

    // hardest 가 없는 영수증(OLDER)으로 바꾸면 비활성
    fireEvent.click(screen.getByRole("button", { name: /지난 영수증 1장/ }));
    fireEvent.click(within(screen.getByLabelText("지난 영수증")).getAllByRole("button", { pressed: false })[0]);
    expect((screen.getByRole("button", { name: "얼어붙은 순간 공유 카드" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("receiptModel 헬퍼", () => {
  it("hardestLabel — 합성 id 는 고정 라벨, 문구는 phrases 에서, 없으면 null", () => {
    expect(hardestLabel(konbini, { phraseId: "tobacco.pick.7", kind: "TOBACCO_PICK", wrongCount: 1, lateCount: 0 })).toEqual({
      ja: "タバコの番号",
      ko: "담배 번호 매칭",
    });
    expect(hardestLabel(konbini, { phraseId: "listen.WARM", kind: "LISTEN", wrongCount: 1, lateCount: 0 })?.ko).toBe("손님 요구 듣기");
    const straw = hardestLabel(konbini, { phraseId: "straw.1", kind: "STRAW", wrongCount: 0, lateCount: 1 });
    expect(straw?.ja).toBe(konbini.phrases.find((p) => p.id === "straw.1")?.ja);
    expect(hardestLabel(konbini, { phraseId: "nope", kind: "STRAW", wrongCount: 0, lateCount: 1 })).toBeNull();
    expect(hardestLabel(konbini, null)).toBeNull();
    // 금액 템플릿은 〇〇 로
    const total = konbini.phrases.find((p) => p.kind === "TOTAL");
    if (total) {
      expect(hardestLabel(konbini, { phraseId: total.id, kind: "TOTAL", wrongCount: 1, lateCount: 0 })?.ja).not.toContain("{total}");
    }
  });

  it("frozenSeconds — hardest 질문의 최장 응답 시간(초), 기록이 없으면 null", () => {
    const base = summaryOf({ hardest: { phraseId: "straw.1", kind: "STRAW", wrongCount: 0, lateCount: 2 } });
    expect(frozenSeconds(base)).toBeNull();
    const withAnswers = summaryOf({
      hardest: { phraseId: "straw.1", kind: "STRAW", wrongCount: 0, lateCount: 2 },
      answers: [
        { customerIndex: 0, kind: "STRAW", correctPhraseId: "straw.1", chosenPhraseId: "straw.1", correct: true, grade: "late", reactionMs: 4260, timedOut: false, attempt: 1, spoken: false },
        { customerIndex: 1, kind: "STRAW", correctPhraseId: "straw.1", chosenPhraseId: null, correct: false, grade: null, reactionMs: 5000, timedOut: true, attempt: 1, spoken: false },
        { customerIndex: 2, kind: "BAG", correctPhraseId: "bag.1", chosenPhraseId: "bag.1", correct: true, grade: "perfect", reactionMs: 9000, timedOut: false, attempt: 1, spoken: false },
      ],
    });
    expect(frozenSeconds(withAnswers)).toBe(5);
    expect(frozenSeconds(summaryOf({ hardest: null }))).toBeNull();
  });

  it("examVerdict — 시험 요약을 직급 정의와 합친다", () => {
    expect(examVerdict(konbini, LATEST)).toBeNull();
    const v = examVerdict(konbini, summaryOf({ exam: { rank: "senpai", comboRequired: 10, passed: true }, maxCombo: 12, missed: 0 }));
    expect(v?.passed).toBe(true);
    expect(v?.rank?.ja).toBe("先輩");
    expect(v?.comboRequired).toBe(10);
  });
});
