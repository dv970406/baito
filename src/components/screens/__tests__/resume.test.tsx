// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ResumeScreen } from "../ResumeScreen";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";

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

function resetStore() {
  useGameStore.setState({
    hydrated: false,
    profile: createDefaultProfile(),
    sessions: [],
    pendingSessions: [],
    audioEnabled: true,
  });
}

function hydrateWith(patch: Partial<ReturnType<typeof createDefaultProfile>>) {
  useGameStore.setState({ hydrated: true, profile: { ...createDefaultProfile(), ...patch } });
}

beforeEach(resetStore);
afterEach(cleanup);

describe("ResumeScreen · 스켈레톤", () => {
  it("복원 전에는 이름 버튼·시급이 없고 직장 목록과 CTA 는 보인다", () => {
    render(<ResumeScreen />);
    expect(screen.getByRole("banner").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("button", { name: /이름 수정/ })).toBeNull();
    expect(screen.queryByText("¥1,000")).toBeNull();
    expect(screen.getByText("BAITO")).toBeTruthy();
    expect(screen.getByRole("link", { name: "KONBINI · 편의점 홈으로" }).getAttribute("href")).toBe("/konbini");
    expect(screen.getByRole("link", { name: "KONBINI 출근하기" }).getAttribute("href")).toBe("/konbini");
  });
});

describe("ResumeScreen · 복원 후", () => {
  it("이름·시급·총 시프트·연속 출근·휴가·직급을 보여준다", () => {
    hydrateWith({ name: "성준", wage: 1170, totalShifts: 12, streak: 5, leavesLeft: 1 });
    render(<ResumeScreen />);
    expect(screen.getByRole("button", { name: "이름 수정 · 성준" })).toBeTruthy();
    expect(screen.getByText("¥1,170")).toBeTruthy();
    expect(screen.getByText(/시프트 12회/)).toBeTruthy();
    expect(screen.getByText("휴가 1회 남음")).toBeTruthy();
    // totalShifts 12 → 先輩(선배)
    expect(screen.getByText("先輩")).toBeTruthy();
    expect(screen.getByText("선배")).toBeTruthy();
    expect(screen.getByText("マルマート 神田南口店 · 선배")).toBeTruthy();
    // 선배(3번째) → 점장까지 3단계
    expect(screen.getByText("점장까지 3단계")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "점장까지 진행" })).toBeTruthy();
  });

  it("잠긴 직장 3개는 점선 카드로, 공항은 여행팩 배지로 보인다", () => {
    hydrateWith({});
    render(<ResumeScreen />);
    expect(screen.getByText("HOTERU · 호텔 프론트")).toBeTruthy();
    expect(screen.getByText("SHOKUDO · 식당")).toBeTruthy();
    expect(screen.getByText("KUKO · 공항")).toBeTruthy();
    expect(screen.getAllByText("KONBINI 점장 달성 시 지원 가능")).toHaveLength(2);
    expect(screen.getByText("여행팩")).toBeTruthy();
    expect(screen.getByText("여행 D-7에 단기 알바로 열림")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "잠김" })).toHaveLength(2);
    // 잠긴 직장은 링크가 아니다
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links.every((h) => h === "/konbini")).toBe(true);
  });

  it("이름을 탭해 고치고 Enter 로 저장하면 setName 이 반영된다", () => {
    hydrateWith({ name: "알바생" });
    render(<ResumeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "이름 수정 · 알바생" }));
    const input = screen.getByRole("textbox", { name: "이름" }) as HTMLInputElement;
    expect(input.value).toBe("알바생");
    fireEvent.change(input, { target: { value: "성준" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useGameStore.getState().profile.name).toBe("성준");
    expect(screen.getByRole("button", { name: "이름 수정 · 성준" })).toBeTruthy();
  });

  it("Escape 는 편집을 취소하고 이름을 바꾸지 않는다", () => {
    hydrateWith({ name: "알바생" });
    render(<ResumeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "이름 수정 · 알바생" }));
    const input = screen.getByRole("textbox", { name: "이름" });
    fireEvent.change(input, { target: { value: "다른이름" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(useGameStore.getState().profile.name).toBe("알바생");
    expect(screen.getByRole("button", { name: "이름 수정 · 알바생" })).toBeTruthy();
  });

  it("사운드 토글이 audioEnabled 를 바꾼다", () => {
    hydrateWith({});
    render(<ResumeScreen />);
    const toggle = screen.getByRole("button", { name: /사운드 켬/ });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(useGameStore.getState().audioEnabled).toBe(false);
    expect(screen.getByRole("button", { name: /사운드 끔/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("세이브 초기화는 두 번 눌러야 실행되고, 취소할 수 있다", () => {
    hydrateWith({ name: "성준", wage: 1500, totalShifts: 20 });
    render(<ResumeScreen />);
    fireEvent.click(screen.getByRole("button", { name: "세이브 초기화" }));
    // 1단계: 아직 초기화되지 않음
    expect(useGameStore.getState().profile.wage).toBe(1500);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: "세이브 초기화" })).toBeTruthy();
    expect(useGameStore.getState().profile.wage).toBe(1500);
    // 2단계: 확인
    fireEvent.click(screen.getByRole("button", { name: "세이브 초기화" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 초기화" }));
    const after = useGameStore.getState();
    expect(after.profile.wage).toBe(1000);
    expect(after.profile.totalShifts).toBe(0);
    expect(after.hydrated).toBe(true);
  });
});
