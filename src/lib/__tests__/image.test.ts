// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShiftSummary } from "@/engine/types";
import { konbini } from "@/content";
import { renderFrozenMomentPng, renderReceiptPng, wrapText } from "../image";

/**
 * jsdom 에는 canvas 구현이 없다(getContext → null). 실제 픽셀은 브라우저에서 확인하고,
 * 여기서는 "캔버스가 없으면 null" 경로와 줄바꿈 계산만 검증한다.
 */

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderReceiptPng / renderFrozenMomentPng", () => {
  it("2D 컨텍스트를 못 얻으면 null 을 돌려주고 예외를 던지지 않는다", async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(renderReceiptPng(summaryOf(), { name: "하루" }, konbini, { day: 3 })).resolves.toBeNull();
    await expect(renderFrozenMomentPng(summaryOf(), konbini)).resolves.toBeNull();
    expect(getContext).toHaveBeenCalled();
  });

  it("getContext 가 예외를 던져도 null", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("no canvas");
    });
    await expect(renderReceiptPng(summaryOf(), { name: "하루" }, konbini)).resolves.toBeNull();
  });

  it("얼어붙은 순간 카드는 hardest 가 없으면 캔버스를 만들지 않고 null", async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(renderFrozenMomentPng(summaryOf({ hardest: null }), konbini)).resolves.toBeNull();
    expect(getContext).not.toHaveBeenCalled();
  });
});

describe("wrapText", () => {
  /** 글자 1자 = 10px 인 가짜 측정기 */
  const ctx = { measureText: (text: string) => ({ width: Array.from(text).length * 10 }) as TextMetrics };

  it("일본어는 글자 단위로 접는다", () => {
    expect(wrapText(ctx, "温めますか？", 40)).toEqual(["温めます", "か？"]);
    expect(wrapText(ctx, "温めますか？", 100)).toEqual(["温めますか？"]);
  });

  it("공백이 있으면 단어 경계를 우선한다", () => {
    expect(wrapText(ctx, "Hot? Yes, hot!", 100)).toEqual(["Hot? Yes,", "hot!"]);
    expect(wrapText(ctx, "Hot? Yes, hot!", 60)).toEqual(["Hot?", "Yes,", "hot!"]);
    // 한 줄보다 긴 단어는 글자 단위로
    expect(wrapText(ctx, "ab supercalifragilistic", 60)).toEqual(["ab sup", "ercali", "fragil", "istic"]);
  });

  it("최대 줄 수를 넘기면 마지막 줄을 … 로 자른다", () => {
    expect(wrapText(ctx, "あいうえおかきくけこさしすせそ", 50, 2)).toEqual(["あいうえお", "かきくけ…"]);
  });

  it("빈 문자열은 빈 배열", () => {
    expect(wrapText(ctx, "", 50)).toEqual([]);
  });
});
