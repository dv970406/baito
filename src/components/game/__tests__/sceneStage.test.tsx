// @vitest-environment jsdom
/**
 * SceneStage — 돌발 이벤트 표지 · 길 묻기 방향 · 시즌 포스터 · 담배 선반 · 취객/관광객 칩 · 영어 말풍선.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Season } from "@/engine/types";
import { ITEMS } from "@/engine/__tests__/fixtures";
import { SceneStage, type SceneStageProps } from "../SceneStage";
import { tobaccoShelfNumbers } from "../shiftModel";

afterEach(cleanup);

function renderScene(over: Partial<SceneStageProps>) {
  const props: SceneStageProps = {
    customerName: "お客さん 1",
    visual: {},
    mood: "neutral",
    bubble: { ja: "お願いします", ko: "부탁해요" },
    irritation: 0,
    patienceMax: 4,
    items: [ITEMS.bento],
    payment: null,
    gradeFlash: null,
    skippable: false,
    onSkip: vi.fn(),
    ...over,
  };
  return render(<SceneStage {...props} />);
}

describe("SceneStage — 돌발 이벤트 손님", () => {
  it("길 묻기(DIRECTIONS): 상품 대신 「駅」 표지가 정답 방향을 가리킨다", () => {
    renderScene({ items: [], event: "DIRECTIONS", direction: "right" });
    expect(screen.queryByRole("list", { name: "카운터 위 상품" })).toBeNull();
    const sign = screen.getByRole("img", { name: "역은 오른쪽" });
    expect(sign.dataset.event).toBe("DIRECTIONS");
    expect(sign.dataset.direction).toBe("right");
    expect(sign.textContent).toContain("駅");
    expect(sign.textContent).toContain("右");
    const arrow = sign.querySelector("svg");
    expect(arrow?.getAttribute("style")).toContain("rotate(90deg)");
  });

  it.each([
    ["left", -90, "왼쪽"],
    ["straight", 0, "직진"],
    ["back", 180, "뒤쪽"],
  ] as const)("방향 %s 는 화살표 %d° · %s", (direction, rotate, ko) => {
    renderScene({ items: [], event: "DIRECTIONS", direction });
    const sign = screen.getByRole("img", { name: `역은 ${ko}` });
    expect(sign.querySelector("svg")?.getAttribute("style")).toContain(`rotate(${rotate}deg)`);
  });

  it("화장실·택배 등은 한자 배지 + 라벨로, 상품 목록은 없다", () => {
    renderScene({ items: [], event: "DELIVERY" });
    const sign = screen.getByRole("img", { name: "택배 손님" });
    expect(sign.dataset.event).toBe("DELIVERY");
    expect(sign.textContent).toContain("宅配");
    expect(screen.queryByRole("list", { name: "카운터 위 상품" })).toBeNull();
  });

  it("이벤트가 없으면 카운터 위에 상품이 놓인다", () => {
    renderScene({ items: [ITEMS.bento, ITEMS.ice] });
    const list = screen.getByRole("list", { name: "카운터 위 상품" });
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(screen.queryByText("駅")).toBeNull();
  });
});

describe("SceneStage — 손님 수식어", () => {
  it("취객이면 「酔」 칩이 붙고 말풍선이 흔들림 표시를 가진다", () => {
    renderScene({ drunk: true });
    expect(screen.getByLabelText("취객").textContent).toBe("酔");
    const bubble = screen.getByText("お願いします").closest("[aria-live]") as HTMLElement;
    expect(bubble.dataset.drunk).toBe("true");
  });

  it("관광객이면 「EN」 칩이 붙고 말풍선 본문은 lang=\"en\"", () => {
    renderScene({ tourist: true, bubble: { ja: "Chopsticks, please.", ko: "젓가락 주세요" } });
    expect(screen.getByLabelText(/외국인 관광객/).textContent).toBe("EN");
    const text = screen.getByText("Chopsticks, please.");
    expect(text.getAttribute("lang")).toBe("en");
    expect(screen.getByText("젓가락 주세요")).toBeTruthy();
  });

  it("보통 손님은 칩이 없고 말풍선은 lang=\"ja\"", () => {
    renderScene({});
    expect(screen.queryByLabelText("취객")).toBeNull();
    expect(screen.queryByLabelText(/외국인 관광객/)).toBeNull();
    expect(screen.getByText("お願いします").getAttribute("lang")).toBe("ja");
  });
});

describe("SceneStage — 뒷벽", () => {
  const season: Season = { month: 12, nameJa: "年末", nameKo: "연말", posterJa: "年末セール" };

  it("시즌이 있으면 포스터(세로 종이)에 posterJa 가 보인다", () => {
    renderScene({ season });
    const poster = screen.getByRole("img", { name: "매장 포스터 · 연말 · 年末セール" });
    expect(poster.textContent).toBe("年末セール");
    expect((poster.firstElementChild as HTMLElement).style.writingMode).toBe("vertical-rl");
  });

  it("시즌이 없으면 포스터가 없다", () => {
    renderScene({ season: null });
    expect(screen.queryByRole("img", { name: /매장 포스터/ })).toBeNull();
  });

  it("담배 선반은 번호 칩을 그리되 손님이 말한 번호와 선택지 번호는 없다", () => {
    const options = [
      { phraseId: "tobacco.pick.27", ja: "27番", ko: "27번", isCorrect: true },
      { phraseId: "tobacco.pick.72", ja: "72番", ko: "72번", isCorrect: false },
      { phraseId: "tobacco.pick.8", ja: "8番", ko: "8번", isCorrect: false },
      { phraseId: "tobacco.pick.28", ja: "28番", ko: "28번", isCorrect: false },
    ];
    const numbers = tobaccoShelfNumbers(options, "27");
    expect(numbers).toHaveLength(5);
    expect(numbers).not.toContain("27");
    expect(numbers).not.toContain("8");
    renderScene({ tobaccoShelf: numbers });
    const shelf = screen.getByRole("img", { name: "담배 선반" });
    for (const n of numbers) expect(shelf.textContent).toContain(n);
    expect(shelf.textContent).not.toMatch(/(^|\D)27(\D|$)/);
  });

  it("번호 목록이 비어 있으면 담배 선반을 그리지 않는다", () => {
    renderScene({ tobaccoShelf: [] });
    expect(screen.queryByRole("img", { name: "담배 선반" })).toBeNull();
  });
});

describe("posterHeadline", () => {
  it("긴 포스터 문구에서 첫 마디만 뽑는다", async () => {
    const { posterHeadline } = await import("../SceneStage");
    expect(posterHeadline("恵方巻ご予約受付中 ─ 今年の恵方は南南東")).toBe("恵方巻ご予約受付中");
    expect(posterHeadline("おでん増量！ 餅巾着入荷 ─ 特大肉まん、始めました")).toBe("おでん増量！");
    expect(posterHeadline("ハロウィンスナック・パンプキンプリン ─ ポイント祭り開催")).toBe("ハロウィンスナック");
    expect(posterHeadline("クリスマスチキン予約受付中 ─ 年越しそば 12/31 まで")).toBe("クリスマスチキン予約受付中");
    expect(posterHeadline("短い")).toBe("短い");
  });
});
