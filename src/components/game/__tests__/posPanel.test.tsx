// @vitest-environment jsdom
/**
 * PosPanel — 질문 종류별 선택지 변형(문장 · 리스닝 아이콘 · 담배 선반), 가려진 선택지, 후리가나 토글.
 * 엔진 fixtures 의 콘텐츠로 실제 buildOptions 결과를 넣어 본다.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOptions, listenId, tobaccoPickId } from "@/engine/distractor";
import { createRng } from "@/engine/rng";
import type { AnswerOption, QuestionKind } from "@/engine/types";
import { CONTENT, ITEMS, customerOf } from "@/engine/__tests__/fixtures";
import { PosPanel, type PosPanelProps } from "../PosPanel";
import { defaultShowKana, KANA_DEFAULT_MAX_LEVEL } from "../shiftModel";

afterEach(cleanup);

function renderPanel(over: Partial<PosPanelProps>) {
  const props: PosPanelProps = {
    registerLabel: "レジ 01",
    total: 498,
    phase: "question",
    kind: "WARM",
    options: [],
    pressedId: null,
    wrongOnStep: 0,
    stepIndex: 0,
    stepCount: 2,
    questionRemainingMs: 4000,
    questionTotalMs: 6000,
    showKo: false,
    onToggleKo: vi.fn(),
    showKana: true,
    onToggleKana: vi.fn(),
    onAnswer: vi.fn(),
    ...over,
  };
  return { ...render(<PosPanel {...props} />), props };
}

const buttons = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("data-state")) as HTMLButtonElement[];

describe("PosPanel — 리스닝 전용(LISTEN)", () => {
  const customer = customerOf([ITEMS.bento]);
  const options = buildOptions(
    { kind: "LISTEN", target: "CHOPSTICKS", correctPhraseId: listenId("CHOPSTICKS") },
    { content: CONTENT, customer, queue: ["LISTEN"], level: 2, rng: createRng(3) },
  );

  it("문장 버튼 대신 아이콘 그리드(2×2)를 그리고, 아이콘 아래 작은 일본어 라벨이 붙는다", () => {
    const { props } = renderPanel({ kind: "LISTEN", options });
    const group = screen.getByRole("group", { name: "선택지" });
    expect(group.dataset.variant).toBe("icon");
    expect(group.className).toContain("grid-cols-2");
    const all = buttons();
    expect(all).toHaveLength(4);
    for (const option of options) {
      const btn = all.find((b) => b.dataset.phraseId === option.phraseId);
      expect(btn?.dataset.variant).toBe("icon");
      expect(btn?.querySelector("svg")?.getAttribute("data-icon")).toBe(option.icon);
      expect(btn?.textContent).toBe(option.ja);
      expect(btn?.className).toContain("min-h-pos-button");
    }
    expect(screen.getByText("손님이 말한 건?")).toBeTruthy();
    fireEvent.click(all[0]);
    expect(props.onAnswer).toHaveBeenCalledWith(all[0].dataset.phraseId);
  });
});

describe("PosPanel — 담배 번호 매칭(TOBACCO_PICK)", () => {
  const customer = customerOf([ITEMS.cigarettes], { tobaccoNumber: "23" });
  const options = buildOptions(
    { kind: "TOBACCO_PICK", correctPhraseId: tobaccoPickId("23") },
    { content: CONTENT, customer, queue: ["TOBACCO_PICK"], level: 3, rng: createRng(5) },
  );

  it("번호 4개가 선반 버튼(번호 크게 · 番 작게)으로 나온다", () => {
    renderPanel({ kind: "TOBACCO_PICK", options });
    expect(screen.getByRole("group", { name: "선택지" }).dataset.variant).toBe("shelf");
    const all = buttons();
    expect(all).toHaveLength(4);
    expect(all.map((b) => b.dataset.phraseId)).toContain(tobaccoPickId("23"));
    const correct = all.find((b) => b.dataset.phraseId === tobaccoPickId("23"));
    expect(correct?.dataset.variant).toBe("shelf");
    const num = correct?.querySelector(".font-num");
    expect(num?.textContent).toBe("23");
    expect(correct?.textContent).toBe("23番");
    expect(screen.getByText("선반에서 꺼낼 번호는?")).toBeTruthy();
  });

  it("TOBACCO_NUMBER 는 일반 문장 버튼", () => {
    const phrase: AnswerOption = { phraseId: "tn", ja: "番号をお願いします", ko: "번호를 말해 주세요", isCorrect: true };
    renderPanel({ kind: "TOBACCO_NUMBER" satisfies QuestionKind, options: [phrase] });
    expect(buttons()[0].dataset.variant).toBe("phrase");
  });
});

describe("PosPanel — 가려진 선택지(masked)와 후리가나", () => {
  const plain: AnswerOption = {
    phraseId: "warm",
    ja: "温めますか？",
    ko: "데워드릴까요?",
    reading: "あたためますか？",
    isCorrect: true,
  };
  const masked: AnswerOption = {
    phraseId: "d.cool",
    ja: "冷やしますか？",
    ko: "차갑게 해드릴까요?",
    reading: "ひやしますか？",
    isCorrect: false,
    masked: true,
  };

  it("masked 면 화면에 〇 가 보이고 원문 한자는 보이지 않으며, 후리가나 줄도 숨긴다", () => {
    renderPanel({ options: [plain, masked], showKana: true });
    const btn = buttons().find((b) => b.dataset.phraseId === "d.cool");
    if (!btn) throw new Error("가려진 버튼을 찾지 못했다");
    expect(btn.dataset.masked).toBe("true");
    expect(btn.className).toContain("border-dashed");
    expect(btn.textContent).toContain("〇やしますか？");
    expect(btn.textContent).not.toContain("冷");
    expect(btn.querySelector("[data-reading]")).toBeNull();
    // 가려지지 않은 쪽은 후리가나가 보인다
    const other = buttons().find((b) => b.dataset.phraseId === "warm");
    expect(other?.querySelector("[data-reading]")?.textContent).toBe("あたためますか？");
    expect(other?.textContent).toContain("温めますか？");
  });

  it("かな 토글이 꺼지면 후리가나 줄이 사라지고, 누르면 onToggleKana 가 불린다", () => {
    const { props } = renderPanel({ options: [plain], showKana: false });
    expect(screen.queryByText("あたためますか？")).toBeNull();
    const chip = screen.getByRole("button", { name: "선택지 후리가나 표시" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(props.onToggleKana).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "선택지 한국어 뜻 표시" })).toBeTruthy();
  });

  it("후리가나 기본값: Lv1~2 ON · Lv3+ OFF, 저장값이 있으면 저장값 우선", () => {
    expect(KANA_DEFAULT_MAX_LEVEL).toBe(2);
    expect(defaultShowKana(1, null)).toBe(true);
    expect(defaultShowKana(2, null)).toBe(true);
    expect(defaultShowKana(3, null)).toBe(false);
    expect(defaultShowKana(4, null)).toBe(false);
    expect(defaultShowKana(1, "0")).toBe(false);
    expect(defaultShowKana(4, "1")).toBe(true);
  });

  it("선택지가 열리기 전(enter)에도 2×2 자리를 비워 두고, 재시도면 안내가 바뀐다", () => {
    const { rerender } = render(
      <PosPanel
        registerLabel="レジ 01"
        total={null}
        phase="enter"
        kind={null}
        options={[]}
        pressedId={null}
        wrongOnStep={0}
        stepIndex={0}
        stepCount={0}
        questionRemainingMs={0}
        questionTotalMs={6000}
        showKo={false}
        onToggleKo={() => undefined}
        showKana
        onToggleKana={() => undefined}
        onAnswer={() => undefined}
      />,
    );
    expect(screen.getByRole("group", { name: "선택지" }).children).toHaveLength(4);
    expect(buttons()).toHaveLength(0);
    rerender(
      <PosPanel
        registerLabel="レジ 01"
        total={498}
        phase="question"
        kind="WARM"
        options={[plain]}
        pressedId={null}
        wrongOnStep={1}
        stepIndex={0}
        stepCount={1}
        questionRemainingMs={3000}
        questionTotalMs={6000}
        showKo={false}
        onToggleKo={() => undefined}
        showKana
        onToggleKana={() => undefined}
        onAnswer={() => undefined}
      />,
    );
    expect(screen.getByText("같은 질문을 한 번 더")).toBeTruthy();
  });
});
