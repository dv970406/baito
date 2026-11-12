// @vitest-environment jsdom
/**
 * 자막 언어(captionLang) — 홈 · 인게임이 영어로 바뀌는지, 영어가 없는 콘텐츠는 한국어로 돌아가는지, 토글이 동작하는지.
 * 복원(hydrated) 전에는 저장값과 무관하게 한국어로 그린다.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { HomeScreen } from "../HomeScreen";
import { ResumeScreen } from "../ResumeScreen";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { PosPanel } from "@/components/game/PosPanel";
import { SceneStage } from "@/components/game/SceneStage";
import { PauseOverlay } from "@/components/game/ShiftOverlays";
import { ITEMS } from "@/engine/__tests__/fixtures";
import type { AnswerOption } from "@/engine/types";
import { buildShareText, hardestTail, shortDate } from "../receiptModel";
import { konbini } from "@/content";
import { useDocumentLang } from "@/i18n/useT";

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

function setStore(hydrated: boolean, captionLang: "ko" | "en") {
  useGameStore.setState({
    hydrated,
    captionLang,
    profile: createDefaultProfile(),
    sessions: [],
    pendingSessions: [],
  });
}

afterEach(() => {
  cleanup();
  setStore(false, "ko");
});

describe("홈 — 영어 자막", () => {
  it("captionLang=en 으로 복원하면 화면 문구가 영어로 바뀐다(일본어 본문은 그대로)", () => {
    setStore(true, "en");
    render(<HomeScreen />);
    expect(screen.getByText("Today's shifts")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main menu" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shifts" })).toBeTruthy();
    // 시프트 이름·설명은 콘텐츠의 영어 필드
    expect(screen.getByRole("link", { name: /Clock in for the Morning shift/ })).toBeTruthy();
    expect(screen.queryByText("오늘 시프트")).toBeNull();
    // 직급 영어 자막(신입 → en)
    const rankEn = konbini.ranks.find((r) => r.id === "shinjin")?.en;
    if (rankEn) expect(screen.getAllByText(new RegExp(rankEn)).length).toBeGreaterThan(0);
  });

  it("복원 전(hydrated=false)에는 저장값이 en 이어도 한국어로 그린다", () => {
    setStore(false, "en");
    render(<HomeScreen />);
    expect(screen.getByText("오늘 시프트")).toBeTruthy();
    expect(screen.queryByText("Today's shifts")).toBeNull();
  });
});

describe("자막 토글", () => {
  it("홈 헤더의 「자막 KO · EN」 을 누르면 store 와 화면 문구가 바뀌고 aria-pressed 가 옮겨 간다", () => {
    setStore(true, "ko");
    render(<HomeScreen />);
    const group = screen.getByRole("group", { name: "자막 언어" });
    const koBtn = within(group).getByRole("button", { name: "한국어 자막" });
    const enBtn = within(group).getByRole("button", { name: "영어 자막" });
    expect(koBtn.getAttribute("aria-pressed")).toBe("true");
    expect(enBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(enBtn);
    expect(useGameStore.getState().captionLang).toBe("en");
    expect(screen.getByText("Today's shifts")).toBeTruthy();
    const enGroup = screen.getByRole("group", { name: "Subtitle language" });
    expect(within(enGroup).getByRole("button", { name: "English subtitles" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(enGroup).getByRole("button", { name: "Korean subtitles" }));
    expect(useGameStore.getState().captionLang).toBe("ko");
    expect(screen.getByText("오늘 시프트")).toBeTruthy();
  });

  it("복원 전에는 눌러도 바뀌지 않는다(비활성)", () => {
    setStore(false, "ko");
    render(<ResumeScreen />);
    const enBtn = screen.getByRole("button", { name: "영어 자막" }) as HTMLButtonElement;
    expect(enBtn.disabled).toBe(true);
  });

  it("인게임 일시정지 오버레이에도 토글이 있다", () => {
    setStore(true, "ko");
    render(<PauseOverlay onResume={vi.fn()} onQuit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "영어 자막" }));
    expect(screen.getByRole("dialog", { name: "Paused" })).toBeTruthy();
    expect(screen.getByText(/Customers are waiting/)).toBeTruthy();
  });

  it("자막 언어가 바뀌면 document.documentElement.lang 이 따라간다", () => {
    function Probe() {
      useDocumentLang();
      return null;
    }
    setStore(true, "ko");
    render(<Probe />);
    expect(document.documentElement.lang).toBe("ko");
    act(() => useGameStore.getState().setCaptionLang("en"));
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("인게임 — 영어 자막", () => {
  const options: AnswerOption[] = [
    { phraseId: "a", ja: "温めますか", ko: "데워 드릴까요?", en: "Would you like it heated?", isCorrect: true },
    { phraseId: "b", ja: "袋いりますか", ko: "봉투 필요하세요?", isCorrect: false },
  ];

  function renderPanel() {
    return render(
      <PosPanel
        registerLabel="レジ 01"
        total={498}
        phase="question"
        kind="WARM"
        options={options}
        pressedId={null}
        wrongOnStep={0}
        stepIndex={0}
        stepCount={1}
        questionRemainingMs={4000}
        questionTotalMs={6000}
        showKo
        onToggleKo={vi.fn()}
        showKana={false}
        onToggleKana={vi.fn()}
        onAnswer={vi.fn()}
      />,
    );
  }

  it("선택지 자막은 en, en 이 없는 선택지는 ko 로 폴백 · 질문 줄과 토글 문구도 영어", () => {
    setStore(true, "en");
    renderPanel();
    expect(screen.getByText("What do you say?")).toBeTruthy();
    expect(screen.getByText("Would you like it heated?")).toBeTruthy();
    expect(screen.getByText("봉투 필요하세요?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show English meaning on choices" })).toBeTruthy();
    // 일본어 본문은 그대로
    expect(screen.getByText("温めますか")).toBeTruthy();
  });

  it("손님 말풍선 자막은 en, 관광객의 영어 대사(본문 = 영어)면 자막을 숨긴다", () => {
    setStore(true, "en");
    const base = {
      customerName: "お客さん 1",
      visual: {},
      mood: "neutral" as const,
      irritation: 0,
      patienceMax: 4,
      items: [ITEMS.bento],
      payment: null,
      gradeFlash: null,
      skippable: false,
      onSkip: vi.fn(),
    };
    const { unmount } = render(
      <SceneStage {...base} bubble={{ ja: "お箸ください", ko: "젓가락 주세요", en: "Chopsticks, please" }} />,
    );
    expect(screen.getByText("Chopsticks, please")).toBeTruthy();
    expect(screen.queryByText("젓가락 주세요")).toBeNull();
    unmount();

    render(
      <SceneStage
        {...base}
        tourist
        bubble={{ ja: "Chopsticks, please", ko: "젓가락 주세요", en: "Chopsticks, please" }}
      />,
    );
    expect(screen.getAllByText("Chopsticks, please")).toHaveLength(1);
    expect(screen.queryByText("젓가락 주세요")).toBeNull();
  });

  it("자막이 ko 면 관광객 영어 대사 아래 한국어 자막이 보인다", () => {
    setStore(true, "ko");
    render(
      <SceneStage
        customerName="お客さん 1"
        visual={{}}
        mood="neutral"
        irritation={0}
        patienceMax={4}
        items={[]}
        payment={null}
        gradeFlash={null}
        skippable={false}
        onSkip={vi.fn()}
        tourist
        bubble={{ ja: "Chopsticks, please", ko: "젓가락 주세요", en: "Chopsticks, please" }}
      />,
    );
    expect(screen.getByText("젓가락 주세요")).toBeTruthy();
  });
});

describe("공유 문구 · 날짜 (en)", () => {
  it("buildShareText 는 lang 에 맞춰 둘째·셋째 줄을 쓰고 ¥ 표기는 유지한다", () => {
    const summary = {
      workplaceId: "konbini",
      slot: "hiru",
      level: 2,
      playedAt: "2026-11-10T04:30:00.000Z",
      durationMs: 1,
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
      hardest: null,
      wageDelta: 40,
      wageAfter: 1170,
      firstSuccessTags: [],
      regularsMet: [],
      endedBy: "customers",
      answers: [],
    } as const;
    const text = buildShareText(konbini, { ...summary, firstSuccessTags: [], regularsMet: [], answers: [] }, "en");
    const lines = text.split("\n");
    expect(lines[0]).toContain("お疲れさまでした");
    expect(lines[1]).toContain("best combo ×11");
    expect(lines[2]).toBe("Today's wage ¥1,170 (+¥40) #BAITO #KONBINI");
    expect(buildShareText(konbini, { ...summary, firstSuccessTags: [], regularsMet: [], answers: [] })).toContain("최고 콤보");
  });

  it("hardestTail · shortDate 의 영어", () => {
    expect(hardestTail({ phraseId: "x", kind: "STRAW", wrongCount: 2, lateCount: 1 }, "en")).toBe(
      "2× said something else · 1× late",
    );
    expect(shortDate("2026-11-10T04:30:00.000Z", "en")).toMatch(/^Nov 1[01]$/);
  });
});
