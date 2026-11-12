// @vitest-environment jsdom
/**
 * ShiftHud — 승급 시험(店長点検) 배지와 조건 칩.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHIFTS } from "@/engine/__tests__/fixtures";
import { ShiftHud } from "../ShiftHud";

afterEach(cleanup);

const base = {
  config: SHIFTS.asa,
  progress: 0.25,
  elapsedRatio: 0.25,
  handled: 2,
  combo: 3,
  paused: false,
  onPause: vi.fn(),
};

describe("ShiftHud — 승급 시험", () => {
  it("시험이 아니면 점검 줄이 없다", () => {
    render(<ShiftHud {...base} />);
    expect(screen.queryByRole("group", { name: "점장 점검 조건" })).toBeNull();
    expect(screen.queryByText("店長点検")).toBeNull();
  });

  it("시험이면 「店長点検」 배지와 콤보 기준 · 이탈 0 조건 칩이 보인다", () => {
    render(<ShiftHud {...base} exam={{ rank: "ippan", comboRequired: 6 }} maxCombo={3} missed={0} />);
    const strip = screen.getByRole("group", { name: "점장 점검 조건" });
    expect(strip.textContent).toContain("店長点検");
    const comboChip = screen.getByRole("status", { name: "콤보 조건 6 이상 · 현재 최고 3" });
    expect(comboChip.textContent).toContain("×3/6");
    expect(comboChip.dataset.tone).toBe("pending");
    const missChip = screen.getByRole("status", { name: "손님 이탈 0" });
    expect(missChip.dataset.tone).toBe("met");
    expect(missChip.className).toContain("bg-perfect-soft");
  });

  it("최고 콤보가 기준을 넘기면 콤보 칩이 충족 색으로", () => {
    render(<ShiftHud {...base} exam={{ rank: "ippan", comboRequired: 6 }} maxCombo={7} missed={0} />);
    const comboChip = screen.getByRole("status", { name: "콤보 조건 6 이상 · 현재 최고 7" });
    expect(comboChip.dataset.tone).toBe("met");
    expect(comboChip.className).toContain("bg-perfect-soft");
  });

  it("손님이 한 명이라도 이탈하면 이탈 칩이 실패 색(irritation)으로 바뀐다", () => {
    render(<ShiftHud {...base} exam={{ rank: "ippan", comboRequired: 6 }} maxCombo={7} missed={1} />);
    const missChip = screen.getByRole("status", { name: "손님 이탈 1 · 조건 실패" });
    expect(missChip.dataset.tone).toBe("failed");
    expect(missChip.dataset.failed).toBe("true");
    expect(missChip.className).toContain("bg-irritation-soft");
    expect(missChip.className).toContain("text-irritation-ink");
  });

  it("콤보 칩과 일시정지 버튼은 그대로", () => {
    render(<ShiftHud {...base} combo={5} exam={{ rank: "senpai", comboRequired: 10 }} maxCombo={5} />);
    expect(screen.getByRole("status", { name: "콤보 5" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "일시정지" })).toBeTruthy();
  });
});
