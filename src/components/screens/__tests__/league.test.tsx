// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftSummary } from "@/engine/types";
import type { LeagueDTO } from "@/shared/api";
import { createDefaultProfile, useGameStore } from "@/store/gameStore";
import { api, ApiError } from "@/store/sync";
import { LeagueScreen, summarizeWeek, weekStartYmd } from "../LeagueScreen";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/store/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/store/sync")>();
  return {
    ...actual,
    api: { ...actual.api, league: vi.fn() },
  };
});

const leagueMock = vi.mocked(api.league);

function session(playedAt: string, wageDelta: number): ShiftSummary {
  return {
    workplaceId: "konbini",
    slot: "asa",
    level: 1,
    playedAt,
    durationMs: 180_000,
    served: 8,
    missed: 0,
    questionCount: 12,
    perfects: 6,
    goods: 4,
    oks: 2,
    lates: 0,
    wrongs: 0,
    maxCombo: 8,
    spokens: 0,
    hardest: null,
    wageDelta,
    wageAfter: 1000 + wageDelta,
    firstSuccessTags: [],
    regularsMet: [],
    endedBy: "customers",
    answers: [],
  };
}

const leagueFixture: LeagueDTO = {
  weekStart: "2026-11-09",
  entries: [
    { playerId: "p1", name: "さくら", weeklyWageDelta: 320, shifts: 5, wage: 1320, rank: 1, isMe: false },
    { playerId: "me", name: "알바생", weeklyWageDelta: 180, shifts: 3, wage: 1180, rank: 2, isMe: true },
    { playerId: "p3", name: "", weeklyWageDelta: -40, shifts: 1, wage: 960, rank: 3, isMe: false },
  ],
  me: { playerId: "me", name: "알바생", weeklyWageDelta: 180, shifts: 3, wage: 1180, rank: 2, isMe: true },
};

beforeEach(() => {
  leagueMock.mockReset();
  useGameStore.setState({
    profile: { ...createDefaultProfile(), wage: 1180 },
    sessions: [],
    hydrated: true,
    sync: { status: "idle", backend: null, lastSyncedAt: null, lastError: null },
  });
});

afterEach(() => {
  cleanup();
});

describe("weekStartYmd / summarizeWeek", () => {
  it("이번 주 월요일을 돌려준다 (일요일은 지난 월요일)", () => {
    expect(weekStartYmd(new Date(2026, 10, 10))).toBe("2026-11-09"); // 화
    expect(weekStartYmd(new Date(2026, 10, 9))).toBe("2026-11-09"); // 월
    expect(weekStartYmd(new Date(2026, 10, 15))).toBe("2026-11-09"); // 일
  });
  it("주 시작일 이후 영수증만 합산한다", () => {
    const sessions = [
      session(new Date(2026, 10, 10, 8).toISOString(), 60),
      session(new Date(2026, 10, 9, 12).toISOString(), 40),
      session(new Date(2026, 10, 8, 20).toISOString(), 999), // 지난 주
    ];
    expect(summarizeWeek(sessions, "2026-11-09")).toEqual({ wageDelta: 100, shifts: 2 });
  });
});

describe("LeagueScreen", () => {
  it("로딩 스켈레톤 → 순위 목록, 내 줄이 강조된다", async () => {
    let resolve!: (v: LeagueDTO) => void;
    leagueMock.mockReturnValue(
      new Promise<LeagueDTO>((r) => {
        resolve = r;
      }),
    );
    render(<LeagueScreen />);
    expect(screen.getByLabelText("순위 불러오는 중")).toBeTruthy();

    resolve(leagueFixture);
    await waitFor(() => expect(screen.queryByLabelText("순위 불러오는 중")).toBeNull());

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const meRow = rows[1];
    expect(meRow.className).toContain("bg-accent-soft");
    expect(meRow.getAttribute("aria-current")).toBe("true");
    expect(within(meRow).getByText("나")).toBeTruthy();
    expect(within(meRow).getByText("+¥180").className).toContain("text-perfect-ink");
    expect(rows[0].className).not.toContain("bg-accent-soft");

    // 이름 없는 플레이어는 名無し, 마이너스는 irritation
    expect(within(rows[2]).getByText("名無し")).toBeTruthy();
    expect(within(rows[2]).getByText("−¥40").className).toContain("text-irritation-ink");

    // 서버가 준 주 시작일로 헤더를 쓴다
    expect(screen.getByText("11月9日（月）〜")).toBeTruthy();
    // me 가 있으니 안내 문구는 없다
    expect(screen.queryByText("이번 주 시프트를 마치면 순위에 올라요")).toBeNull();
  });

  it("me 가 null 이고 항목이 있으면 안내 문구를 붙인다", async () => {
    leagueMock.mockResolvedValue({ ...leagueFixture, me: null, entries: leagueFixture.entries.map((e) => ({ ...e, isMe: false })) });
    render(<LeagueScreen />);
    await screen.findByText("이번 주 시프트를 마치면 순위에 올라요");
    expect(screen.queryByText("나")).toBeNull();
  });

  it("503(서버 미설정)이면 準備中 빈 상태를 보여주고 오류 스택은 없다", async () => {
    leagueMock.mockRejectedValue(new ApiError(503, "SUPABASE_NOT_CONFIGURED", "Supabase 환경 변수가 없습니다"));
    render(<LeagueScreen />);
    await screen.findByText("準備中");
    expect(screen.getByText("리그 집계는 서버 연결 후 열려요")).toBeTruthy();
    expect(screen.queryByText(/Supabase/)).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 불러오기" })).toBeNull();
    // 로컬 기록 카드는 그대로 보인다 — 화면이 비지 않는다
    expect(screen.getByTestId("my-week")).toBeTruthy();
  });

  it("네트워크 오류면 오프라인 문구와 재시도 버튼, 재시도하면 다시 요청한다", async () => {
    leagueMock.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(leagueFixture);
    render(<LeagueScreen />);
    await screen.findByText("지금은 오프라인이에요. 연결되면 순위를 불러올게요");
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await screen.findByText("さくら");
    expect(leagueMock).toHaveBeenCalledTimes(2);
  });

  it("스토어가 unconfigured 면 어떤 오류든 서버 연결 문구를 쓴다", async () => {
    useGameStore.setState({ sync: { status: "unconfigured", backend: null, lastSyncedAt: null, lastError: null } });
    leagueMock.mockRejectedValue(new Error("boom"));
    render(<LeagueScreen />);
    await screen.findByText("리그 집계는 서버 연결 후 열려요");
  });

  it("로컬 영수증으로 나의 이번 주 카드를 채운다", async () => {
    leagueMock.mockResolvedValue({ ...leagueFixture, entries: [], me: null });
    const now = new Date();
    useGameStore.setState({ sessions: [session(now.toISOString(), 60), session(now.toISOString(), -20)] });
    render(<LeagueScreen />);
    const card = screen.getByTestId("my-week");
    expect(within(card).getByText("+¥40")).toBeTruthy();
    expect(within(card).getByText("2회")).toBeTruthy();
    expect(within(card).getByText("¥1,180")).toBeTruthy();
    await screen.findByText("まだ誰もいない");
  });

  it("탭바는 리그 탭이 활성이다", async () => {
    leagueMock.mockResolvedValue(leagueFixture);
    render(<LeagueScreen />);
    expect(screen.getByRole("link", { name: "리그" }).getAttribute("aria-current")).toBe("page");
    await screen.findByText("さくら");
  });
});
