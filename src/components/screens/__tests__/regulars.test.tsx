// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { konbini } from "@/content";
import type { PlayerProfile } from "@/shared/player";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { LONG_PRESS_MS, RegularsScreen, findPhraseFor, seasonBadge } from "../RegularsScreen";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** 田中(아침·open)는 만났고, 鈴木는 해금됐지만 아직, ゆい(저녁 시프트)·佑(선배)·サンタ(12월)는 잠김 */
function fixtureProfile(): PlayerProfile {
  const base = createDefaultProfile(new Date(2026, 10, 10)); // 2026-11-10 (화)
  return {
    ...base,
    totalShifts: 1,
    regulars: {
      tanaka: {
        affinity: 3,
        metCount: 7,
        lastMetDate: "2026-11-10",
        firstWordsHeard: ["番号で", "レシートいらない"],
      },
    },
  };
}

beforeEach(() => {
  useGameStore.setState({ profile: fixtureProfile(), hydrated: true });
});

afterEach(() => {
  cleanup();
  useGameStore.setState({ profile: createDefaultProfile(), hydrated: false });
});

describe("RegularsScreen", () => {
  it("복원 전에는 스켈레톤을 보여준다", () => {
    useGameStore.setState({ hydrated: false });
    render(<RegularsScreen />);
    expect(screen.getByLabelText("도감 불러오는 중")).toBeTruthy();
    expect(screen.queryByText("田中")).toBeNull();
  });

  it("만남 수와 상태별 카드(만남·실루엣·잠김)를 그린다", () => {
    const { container } = render(<RegularsScreen />);
    expect(screen.getByText(new RegExp(`1 / ${konbini.regulars.length} 만남`))).toBeTruthy();

    // 만난 단골 — 이름·역할·호감도·현재 대사·처음 들은 말
    const met = container.querySelector('[data-regular="tanaka"][data-status="met"]');
    expect(met).toBeTruthy();
    expect(within(met as HTMLElement).getByText("田中")).toBeTruthy();
    expect(within(met as HTMLElement).getByText(/샐러리맨 · 7번 만남/)).toBeTruthy();
    expect(within(met as HTMLElement).getByRole("img", { name: "호감도 3 / 5" })).toBeTruthy();
    expect(within(met as HTMLElement).getByText("「最近、禁煙しようかと思ってて」")).toBeTruthy();
    expect(within(met as HTMLElement).getByText(/「番号で」 「レシートいらない」/)).toBeTruthy();
    expect(within(met as HTMLElement).getByText("아침 단골")).toBeTruthy();

    // 해금됐지만 아직 못 만난 손님 — 실루엣 + 시간대 힌트만
    const unmet = container.querySelectorAll('[data-status="unmet"]');
    expect(unmet.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-regular="suzuki"][data-status="unmet"]')).toBeTruthy();
    expect(screen.queryByText("鈴木")).toBeNull();

    // 잠김 — 해금 조건 라벨
    expect(screen.getByText("저녁 시프트")).toBeTruthy();
    expect(screen.getByText("심야 시프트")).toBeTruthy();
    expect(screen.getByText("선배 승급")).toBeTruthy();
    expect(screen.getAllByText("12월 시즌").length).toBeGreaterThan(0);

    // 전체 12명이 어느 상태로든 한 번씩 등장
    const metCount = container.querySelectorAll('[data-status="met"]').length;
    const unmetCount = unmet.length;
    const lockedCount = screen.getAllByText("???").length - unmetCount;
    expect(metCount + unmetCount + lockedCount).toBe(konbini.regulars.length);
  });

  it("필터 칩이 카드 수를 줄인다", () => {
    const { container } = render(<RegularsScreen />);
    // 실루엣·잠김 카드는 둘 다 "???" 를 제목으로 쓴다 (만난 1명 빼고 11장)
    expect(screen.getAllByText("???")).toHaveLength(konbini.regulars.length - 1);

    fireEvent.click(screen.getByRole("button", { name: "만난 단골" }));
    expect(screen.getByRole("button", { name: "만난 단골" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelectorAll('[data-status="met"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-status="unmet"]')).toHaveLength(0);
    expect(screen.queryByText("???")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "미발견" }));
    expect(container.querySelectorAll('[data-status="met"]')).toHaveLength(0);
    expect(screen.getAllByText("???")).toHaveLength(konbini.regulars.length - 1);

    // 朝 — 田中(만남)·鈴木·小林(실루엣) 셋만. 잠긴 카드는 없다
    fireEvent.click(screen.getByRole("button", { name: /朝/ }));
    const asaCount = konbini.regulars.filter((r) => r.slots.includes("asa")).length;
    expect(container.querySelectorAll('[data-status="met"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-status="unmet"]')).toHaveLength(asaCount - 1);
    expect(screen.getAllByText("???")).toHaveLength(asaCount - 1);
    expect(screen.queryByText("저녁 시프트")).toBeNull();
    expect(container.querySelector('[data-regular="tanaka"]')).toBeTruthy();
  });

  it("아코디언이 열리면 호감도 대사 5줄(미달은 ・・・)과 처음 들은 말 목록이 보인다", () => {
    const { container } = render(<RegularsScreen />);
    const met = container.querySelector('[data-regular="tanaka"]') as HTMLElement;
    const toggle = within(met).getByRole("button", { expanded: false });
    act(() => {
      fireEvent.click(toggle);
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(toggle.getAttribute("aria-controls") as string) as HTMLElement;
    expect(panel.hidden).toBe(false);

    // 호감도 1~3은 열림, 4·5는 가림
    expect(within(panel).getByText("今日、会議が三つ。缶コーヒーじゃ足りないな。")).toBeTruthy();
    expect(within(panel).getByText("最近、禁煙しようかと思ってて")).toBeTruthy();
    expect(within(panel).queryByText("23番、今日はやめとく。……ガムある？")).toBeNull();
    expect(within(panel).getAllByText("・・・")).toHaveLength(2);

    // 처음 들은 말: 2 / 3, 들은 것만 체크와 번역
    expect(within(panel).getByText("처음 들은 말 · 2 / 3")).toBeTruthy();
    expect(within(panel).getAllByRole("img", { name: "들었음" })).toHaveLength(2);
    expect(within(panel).getByText("번호로")).toBeTruthy();
    expect(within(panel).queryByText("봉투 됐어요")).toBeNull();
    const unheard = panel.querySelector('[data-heard="false"]') as HTMLElement;
    expect(within(unheard).getByText("「袋いい」").className).toContain("text-ink-muted");

    // 다시 누르면 닫힌다
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
  });

  it("처음 들은 말 카드는 길게 누르면(500ms) 뜻이 펼쳐지고, 짧게 누르면 그대로, Enter 로도 토글된다", () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<RegularsScreen />);
      const met = container.querySelector('[data-regular="tanaka"]') as HTMLElement;
      act(() => {
        fireEvent.click(within(met).getByRole("button", { expanded: false }));
      });
      const card = within(met).getByRole("button", { name: "「番号で」 뜻 보기 (길게 누르기)" });
      expect(card.getAttribute("aria-expanded")).toBe("false");
      const detail = document.getElementById(card.getAttribute("aria-controls") as string) as HTMLElement;
      expect(detail.hidden).toBe(true);

      // 짧게 누르기 — 펼치지 않는다
      fireEvent.pointerDown(card);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS - 100);
      });
      fireEvent.pointerUp(card);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      expect(card.getAttribute("aria-expanded")).toBe("false");

      // 길게 누르기 — 펼친다
      fireEvent.pointerDown(card);
      act(() => {
        vi.advanceTimersByTime(LONG_PRESS_MS);
      });
      expect(card.getAttribute("aria-expanded")).toBe("true");
      expect(detail.hidden).toBe(false);
      expect(within(detail).getByText("번호로")).toBeTruthy();

      // Enter 로 닫기
      fireEvent.keyDown(card, { key: "Enter" });
      expect(card.getAttribute("aria-expanded")).toBe("false");

      // 못 들은 말은 비활성 버튼
      const unheard = within(met).getByText("「袋いい」").closest("button") as HTMLButtonElement;
      expect(unheard.disabled).toBe(true);
      expect(unheard.getAttribute("aria-expanded")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("findPhraseFor — 접객 문구와 같은 말이면 읽기·단어 분해를 빌려 온다", () => {
    const warm = konbini.phrases.find((p) => p.id === "warm.1");
    expect(warm).toBeTruthy();
    const found = findPhraseFor({ ja: warm?.ja ?? "", ko: "데워 드릴까요?" }, konbini.phrases);
    expect(found?.id).toBe("warm.1");
    expect(found?.parts).toBeTruthy();
    expect(findPhraseFor({ ja: "番号で", ko: "번호로" }, konbini.phrases)).toBeUndefined();
  });

  it("시즌 한정 단골은 「N월 한정」 배지, 심야 단골은 深夜 칩", () => {
    const santa = konbini.regulars.find((r) => r.id === "santa");
    expect(santa && seasonBadge(santa)).toBe("12월 한정");
    const tanaka = konbini.regulars.find((r) => r.id === "tanaka");
    expect(tanaka && seasonBadge(tanaka)).toBeNull();

    // 잠긴 산타 카드에는 캡션으로, 만난 뒤에는 배지로 (12월이 아니면 잠김 표기)
    const { container } = render(<RegularsScreen />);
    expect(screen.getAllByText("12월 한정").length).toBeGreaterThan(0);
    cleanup();
    useGameStore.setState({
      profile: {
        ...fixtureProfile(),
        regulars: {
          santa: { affinity: 1, metCount: 1, lastMetDate: "2026-12-24", firstWordsHeard: [] },
        },
      },
    });
    const second = render(<RegularsScreen />);
    const met = second.container.querySelector('[data-regular="santa"][data-status="met"]') as HTMLElement;
    const badge = within(met).getByTestId("season-badge");
    const month = new Date().getMonth() + 1;
    expect(badge.textContent).toBe(month === 12 ? "12월 한정" : "12월 한정 · 잠김");
    expect(container).toBeTruthy();
    // 심야 필터 칩이 있다
    expect(screen.getByRole("button", { name: /深/ })).toBeTruthy();
  });

  it("탭바는 도감 탭이 활성이다", () => {
    render(<RegularsScreen />);
    expect(screen.getByRole("link", { name: "도감" }).getAttribute("aria-current")).toBe("page");
  });
});
