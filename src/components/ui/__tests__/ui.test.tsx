// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Avatar,
  Badge,
  ComboChip,
  IrritationGauge,
  ItemSprite,
  KanjiBadge,
  MoneyText,
  PosButton,
  ProgressBar,
  RegisterDisplay,
  SpeechBubble,
  TabBar,
  TimerRing,
} from "..";

afterEach(cleanup);

describe("TabBar", () => {
  it("4개 탭을 링크로 렌더링하고 활성 탭에 accent 와 aria-current 를 준다", () => {
    render(<TabBar active="regulars" />);
    const nav = screen.getByRole("navigation", { name: "주 메뉴" });
    expect(nav).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/konbini",
      "/konbini/regulars",
      "/konbini/receipt",
      "/konbini/league",
    ]);
    const active = screen.getByRole("link", { name: "도감" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("text-accent");
    const inactive = screen.getByRole("link", { name: "시프트" });
    expect(inactive.className).toContain("text-ink-muted");
    expect(inactive.className).not.toContain("text-ink-faint");
  });
  it("hrefs 로 링크를 덮어쓴다", () => {
    render(<TabBar active="shift" hrefs={{ league: "/hoteru/league" }} />);
    expect(screen.getByRole("link", { name: "리그" }).getAttribute("href")).toBe("/hoteru/league");
  });
});

describe("PosButton", () => {
  it("상태별 테두리/배경 클래스와 data-state 를 가진다", () => {
    const { rerender } = render(<PosButton ja="温めますか？" state="idle" />);
    const btn = screen.getByRole("button", { name: "温めますか？" });
    expect(btn.dataset.state).toBe("idle");
    expect(btn.className).toContain("border-border");
    expect(btn.className).toContain("min-h-pos-button");
    expect(btn.className).toContain("rounded-xl");

    rerender(<PosButton ja="温めますか？" state="correct" />);
    expect(btn.className).toContain("border-perfect");
    expect(btn.className).toContain("bg-perfect-soft");

    rerender(<PosButton ja="温めますか？" state="wrong" />);
    expect(btn.className).toContain("border-irritation");
    expect(btn.className).toContain("bg-irritation-soft");

    rerender(<PosButton ja="温めますか？" state="dimmed" />);
    expect(btn.className).toContain("opacity-60");
  });
  it("showKo 일 때만 한국어 부제를 보여준다", () => {
    const { rerender } = render(<PosButton ja="お箸はお付けしますか？" ko="젓가락 넣어드릴까요?" />);
    expect(screen.queryByText("젓가락 넣어드릴까요?")).toBeNull();
    rerender(<PosButton ja="お箸はお付けしますか？" ko="젓가락 넣어드릴까요?" showKo />);
    expect(screen.getByText("젓가락 넣어드릴까요?").className).toContain("text-ink-muted");
  });
  it("클릭 핸들러와 disabled 가 동작한다", () => {
    const onClick = vi.fn();
    render(<PosButton ja="A" onClick={onClick} disabled />);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IrritationGauge", () => {
  it("aria-label 과 점 개수", () => {
    const { container } = render(<IrritationGauge value={1} />);
    expect(screen.getByRole("img", { name: "짜증 게이지 1/4" })).toBeTruthy();
    expect(container.querySelectorAll(".bg-irritation")).toHaveLength(1);
    expect(container.querySelectorAll(".bg-border")).toHaveLength(3);
  });
  it("value 를 max 로 자른다", () => {
    render(<IrritationGauge value={9} max={5} />);
    expect(screen.getByRole("img", { name: "짜증 게이지 5/5" })).toBeTruthy();
  });
});

describe("MoneyText / RegisterDisplay", () => {
  it("금액을 포맷하고 사이즈 클래스를 붙인다", () => {
    render(<MoneyText yen={1170} size="money-xl" />);
    const el = screen.getByText("¥1,170");
    expect(el.className).toContain("text-money-xl");
    expect(el.className).toContain("font-num");
  });
  it("delta 는 부호와 상태색", () => {
    const { rerender } = render(<MoneyText yen={40} delta />);
    expect(screen.getByText("+¥40").className).toContain("text-perfect-ink");
    rerender(<MoneyText yen={-25} delta />);
    expect(screen.getByText("−¥25").className).toContain("text-irritation-ink");
  });
  it("RegisterDisplay 는 合計 ¥598", () => {
    render(<RegisterDisplay yen={598} />);
    expect(screen.getByText("合計")).toBeTruthy();
    expect(screen.getByText("¥598").parentElement?.className).toContain("text-register-glow");
  });
});

describe("Avatar", () => {
  it.each([
    ["neutral", "보통"],
    ["happy", "기분 좋음"],
    ["confused", "당황"],
    ["annoyed", "짜증"],
    ["gone", "떠남"],
  ] as const)("mood=%s → aria-label 에 '%s'", (mood, ko) => {
    render(<Avatar name="田中" mood={mood} />);
    const el = screen.getByRole("img", { name: `田中 · ${ko}` });
    expect(el.dataset.mood).toBe(mood);
  });
  it("scene 사이즈에 몸통·칼라·넥타이를 그린다", () => {
    const { container } = render(
      <Avatar
        name="田中"
        size="scene"
        body
        visual={{ hairStyle: "short", hairColor: "#2B2A33", outfit: "#2E3A59", accent: "#C8322B" }}
      />,
    );
    expect(container.querySelector(".size-avatar-scene")).toBeTruthy();
    const body = container.querySelector(".w-\\[150px\\]") as HTMLElement | null;
    expect(body).toBeTruthy();
    expect(body?.style.background).toBe("rgb(46, 58, 89)"); // jsdom 은 hex 를 rgb 로 정규화한다
    // 칼라(흰 삼각형) + 넥타이
    expect(body?.querySelectorAll("span")).toHaveLength(2);
  });
  it("hairStyle 을 data-hair 로 노출하고 bald 는 머리카락을 그리지 않는다", () => {
    const { container } = render(<Avatar name="X" visual={{ hairStyle: "bald" }} size="sm" />);
    expect(screen.getByRole("img").dataset.hair).toBe("bald");
    expect(container.querySelector(".size-avatar-sm")?.querySelectorAll("span").length).toBe(4); // 피부 + 눈2 + 입
  });
});

describe("기타 스모크", () => {
  it("ProgressBar 는 role=progressbar 와 값", () => {
    render(<ProgressBar value={0.38} label="시프트 진행" />);
    const bar = screen.getByRole("progressbar", { name: "시프트 진행" });
    expect(bar.getAttribute("aria-valuenow")).toBe("38");
  });
  it("TimerRing 은 소수 한 자리 초", () => {
    render(<TimerRing remainingMs={2140} totalMs={4000} />);
    expect(screen.getByRole("timer", { name: "남은 시간 2.1초" })).toBeTruthy();
    expect(screen.getByText("2.1")).toBeTruthy();
  });
  it("ComboChip 은 ×N", () => {
    const { rerender } = render(<ComboChip n={7} />);
    expect(screen.getByRole("status", { name: "콤보 7" })).toBeTruthy();
    expect(screen.getByText("×7")).toBeTruthy();
    rerender(<ComboChip n={8} />);
    expect(screen.getByText("×8")).toBeTruthy();
  });
  it("SpeechBubble 은 빈 대사를 … 로", () => {
    const { rerender } = render(<SpeechBubble ja="" />);
    expect(screen.getByText("…")).toBeTruthy();
    rerender(<SpeechBubble ja="お願いします" ko="부탁해요" tail="right" />);
    expect(screen.getByText("お願いします")).toBeTruthy();
    expect(screen.getByText("부탁해요").className).toContain("text-caption");
  });
  it("Badge / KanjiBadge 톤", () => {
    render(
      <>
        <Badge tone="perfect">근무 중</Badge>
        <KanjiBadge kanji="朝" tone="accent" label="아침 시프트" />
      </>,
    );
    expect(screen.getByText("근무 중").className).toContain("bg-perfect-soft");
    expect(screen.getByLabelText("아침 시프트").className).toContain("bg-accent");
  });
  it("ItemSprite 는 이름을 aria-label 과 알약으로", () => {
    render(<ItemSprite visual={{ shape: "bento", color: "#E9D8A8", accent: "#C9B98F" }} name="のり弁当" />);
    const img = screen.getByRole("img", { name: "のり弁当" });
    expect(img.dataset.shape).toBe("bento");
    expect(screen.getByText("のり弁当").className).toContain("rounded-pill");
  });
});
