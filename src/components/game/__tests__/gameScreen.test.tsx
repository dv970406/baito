// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { konbini } from "@/content";
import { createShift, shiftReducer, TIMING } from "@/engine/shift";
import type { ShiftState } from "@/engine/types";
import { useGameStore, createDefaultProfile } from "@/store/gameStore";
import { selectUnlockedTags } from "@/store/selectors";
import { GameScreen } from "../GameScreen";
import { availableRegulars, LAST_RECEIPT_KEY } from "../shiftModel";
import type { SpeechRecognitionLike } from "@/lib/speech";
import { localYmd } from "@/store/date";

/* ───────────────────────── 목 ───────────────────────── */

// vi.mock 은 파일 맨 위로 끌어올려지므로 목 객체는 vi.hoisted 로 만든다
const { routerMock, audioMock, syncMock } = vi.hoisted(() => ({
  routerMock: { replace: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() },
  audioMock: {
    unlockAudio: vi.fn(),
    playSfx: vi.fn(),
    speakJa: vi.fn(),
    stopSpeaking: vi.fn(),
    isAudioEnabled: () => true,
    setAudioEnabled: vi.fn(),
  },
  syncMock: { pushShiftResult: vi.fn(() => Promise.resolve()) },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/konbini/shift/asa",
}));
vi.mock("@/lib/audio", () => audioMock);
vi.mock("@/store/sync", () => syncMock);

/* ───────────────────────── 헬퍼 ───────────────────────── */

const SEED = 7;
const SLOT = "asa" as const;
const CONFIG = konbini.shifts[SLOT];

/** 화면과 같은 입력으로 만든 "그림자 엔진" — 정답 선택지와 말풍선을 미리 안다 */
function mirrorShift(): ShiftState {
  const profile = useGameStore.getState().profile;
  return createShift({
    content: konbini,
    config: CONFIG,
    seed: SEED,
    tagWeights: profile.tagWeights,
    regularsAvailable: availableRegulars(konbini, profile, SLOT, new Date().getMonth() + 1),
    unlockedTags: selectUnlockedTags(profile, konbini.ranks),
  });
}
const start = (s: ShiftState) => shiftReducer(s, { type: "START" }, konbini);
const skip = (s: ShiftState) => shiftReducer(s, { type: "SKIP_PHASE" }, konbini);
const tick = (s: ShiftState, dtMs: number) => shiftReducer(s, { type: "TICK", dtMs }, konbini);
const answer = (s: ShiftState, id: string) => shiftReducer(s, { type: "ANSWER", phraseId: id }, konbini);
const correctOf = (s: ShiftState) => {
  const o = s.options.find((x) => x.isCorrect);
  if (!o) throw new Error("정답 선택지가 없다");
  return o;
};

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

/** 선택지 버튼(POS 버튼)만 — data-state 를 가진 버튼 */
const optionButtons = () =>
  screen.getAllByRole("button").filter((b) => b.hasAttribute("data-state")) as HTMLButtonElement[];

/** 렌더 → 出勤 탭. (findBy* 는 가짜 타이머와 함께 쓰면 멈추므로 동기 getBy* 만 쓴다) */
function clockIn() {
  render(<GameScreen slot={SLOT} seedOverride={SEED} />);
  fireEvent.click(screen.getByRole("button", { name: "出勤" }));
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "performance",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  useGameStore.setState({
    hydrated: true,
    profile: createDefaultProfile(),
    sessions: [],
    pendingSessions: [],
    audioEnabled: true,
  });
  window.sessionStorage.clear();
  routerMock.replace.mockClear();
  routerMock.push.mockClear();
  audioMock.playSfx.mockClear();
  audioMock.speakJa.mockClear();
  audioMock.unlockAudio.mockClear();
  syncMock.pushShiftResult.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* ───────────────────────── 테스트 ───────────────────────── */

describe("GameScreen — 출근 전", () => {
  it("복원 전엔 出勤 버튼이 비활성(준비 중)", async () => {
    useGameStore.setState({ hydrated: false });
    render(<GameScreen slot={SLOT} seedOverride={SEED} />);
    const cta = screen.getByRole("button", { name: /出勤準備中/ });
    expect((cta as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("出勤準備中");
  });

  it("아직 열리지 않은 시프트면 안내 카드와 홈 링크를 보여준다", () => {
    render(<GameScreen slot="yoru" seedOverride={SEED} />);
    expect(screen.getByText("이 시프트는 지금 출근할 수 없어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /시프트 표로/ }).getAttribute("href")).toBe("/konbini");
  });

  it("출근 전 시트에 매장·시간대·손님 수·제한시간이 보이고 出勤 을 누르면 오디오를 깨운다", async () => {
    clockIn();
    expect(audioMock.unlockAudio).toHaveBeenCalledTimes(1);
    // 시트가 닫히고 손님이 들어온다(입점 차임)
    expect(screen.queryByRole("button", { name: "出勤" })).toBeNull();
    advance(20);
    expect(audioMock.playSfx).toHaveBeenCalledWith("chime");
  });
});

describe("GameScreen — 인게임 루프", () => {
  it("enter 연출이 끝나면 선택지 4개가 열리고, 정답을 누르면 손님 응답 말풍선과 속도 등급이 보인다", async () => {
    clockIn();
    advance(TIMING.ENTER_MS + 60);

    const mirror = skip(start(mirrorShift()));
    expect(mirror.phase).toBe("question");
    const buttons = optionButtons();
    expect(buttons).toHaveLength(4);
    expect(new Set(buttons.map((b) => b.textContent))).toEqual(new Set(mirror.options.map((o) => o.ja)));
    buttons.forEach((b) => expect(b.disabled).toBe(false));

    const correct = correctOf(mirror);
    const target = buttons.find((b) => b.textContent === correct.ja);
    if (!target) throw new Error("정답 버튼을 찾지 못했다");
    fireEvent.click(target);

    const after = answer(tick(mirror, 50), correct.phraseId);
    expect(after.phase).toBe("reply");
    expect(screen.getByText(after.bubble?.ja ?? "")).toBeTruthy();
    expect(target.dataset.state).toBe("correct");
    const others = optionButtons().filter((b) => b !== target);
    others.forEach((b) => expect(b.dataset.state).toBe("dimmed"));
    expect(screen.getByText("PERFECT")).toBeTruthy();
    expect(audioMock.playSfx).toHaveBeenCalledWith("perfect");
    expect(audioMock.speakJa).toHaveBeenCalledWith(correct.ja, { voice: "clerk" });
  });

  it("오답은 '정답/오답' 글자 없이 손님의 당황 리액션으로 돌아오고, 같은 질문을 다시 준다", async () => {
    clockIn();
    advance(TIMING.ENTER_MS + 60);
    const mirror = skip(start(mirrorShift()));
    const wrong = mirror.options.find((o) => !o.isCorrect);
    if (!wrong) throw new Error("오답 선택지가 없다");
    const target = optionButtons().find((b) => b.textContent === wrong.ja);
    if (!target) throw new Error("오답 버튼을 찾지 못했다");
    fireEvent.click(target);

    const after = answer(tick(mirror, 50), wrong.phraseId);
    expect(after.afterReply).toBe("retry");
    expect(screen.getByText(after.bubble?.ja ?? "")).toBeTruthy();
    expect(target.dataset.state).toBe("wrong");
    // 정답은 드러내지 않는다
    optionButtons()
      .filter((b) => b !== target)
      .forEach((b) => expect(b.dataset.state).toBe("dimmed"));
    expect(screen.queryByText(/정답|오답/)).toBeNull();
    expect(audioMock.playSfx).toHaveBeenCalledWith("wrong");

    // 당황 연출이 끝나면 같은 선택지로 재시도 — "같은 질문을 한 번 더"
    advance(TIMING.CONFUSED_MS + 60);
    expect(screen.getByText("같은 질문을 한 번 더")).toBeTruthy();
    expect(new Set(optionButtons().map((b) => b.textContent))).toEqual(new Set(mirror.options.map((o) => o.ja)));
    optionButtons().forEach((b) => expect(b.dataset.state).toBe("idle"));
  });

  it("시간 초과도 오답으로 처리되어 손님이 당황한다", async () => {
    clockIn();
    advance(TIMING.ENTER_MS + 60);
    const mirror = skip(start(mirrorShift()));
    advance(CONFIG.questionTimeSec * 1000 + 100);
    const after = tick(mirror, CONFIG.questionTimeSec * 1000 + 100);
    expect(after.phase).toBe("reply");
    expect(screen.getByText(after.bubble?.ja ?? "")).toBeTruthy();
    expect(audioMock.playSfx).toHaveBeenCalledWith("wrong");
  });

  it("일시정지 → やめる 는 저장 없이 홈으로", async () => {
    clockIn();
    advance(TIMING.ENTER_MS + 60);
    fireEvent.click(screen.getByRole("button", { name: "일시정지" }));
    expect(screen.getByRole("dialog", { name: "일시정지" })).toBeTruthy();
    // 멈춘 동안 시간이 흘러도 질문 타이머는 그대로
    const before = screen.getByRole("timer").getAttribute("aria-label");
    advance(2000);
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: /やめる/ }));
    expect(routerMock.push).toHaveBeenCalledWith("/konbini");
    expect(useGameStore.getState().sessions).toHaveLength(0);
  });
});

describe("GameScreen — 마감", () => {
  it("모든 손님을 응대하면 completeShift 1회 · sessionStorage · 서버 전송 · 영수증 이동", async () => {
    clockIn();
    let mirror = start(mirrorShift());
    const customerCount = CONFIG.customerCount;

    for (let guard = 0; guard < 400 && !routerMock.replace.mock.calls.length; guard++) {
      const enabled = optionButtons().filter((b) => !b.disabled);
      if (enabled.length === 4) {
        // 그림자 엔진을 같은 질문까지 끌어온다
        while (mirror.phase !== "question" && mirror.phase !== "done") mirror = skip(mirror);
        const correct = correctOf(mirror);
        const target = enabled.find((b) => b.textContent === correct.ja);
        if (!target) throw new Error(`정답 버튼을 찾지 못했다: ${correct.ja}`);
        fireEvent.click(target);
        mirror = answer(tick(mirror, 50), correct.phraseId);
        advance(TIMING.REPLY_MS + 40);
      } else {
        advance(200);
      }
    }

    const store = useGameStore.getState();
    expect(store.sessions).toHaveLength(1);
    const summary = store.sessions[0];
    expect(summary.served).toBe(customerCount);
    expect(summary.missed).toBe(0);
    expect(summary.endedBy).toBe("customers");
    expect(summary.wageAfter).toBe(store.profile.wage);
    expect(store.profile.totalShifts).toBe(1);
    expect(store.profile.today.completed).toContain(SLOT);
    // 만난 레귤러의 "처음 들은 말"이 기록된다
    for (const id of summary.regularsMet) {
      expect(store.profile.regulars[id]?.firstWordsHeard.length ?? 0).toBeGreaterThan(0);
    }

    expect(JSON.parse(window.sessionStorage.getItem(LAST_RECEIPT_KEY) ?? "null")?.playedAt).toBe(summary.playedAt);
    expect(syncMock.pushShiftResult).toHaveBeenCalledTimes(1);
    expect(syncMock.pushShiftResult).toHaveBeenCalledWith(summary);
    expect(routerMock.replace).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).toHaveBeenCalledWith("/konbini/receipt?latest=1");
    expect(screen.getByRole("dialog", { name: "마감" }).textContent).toContain("お疲れさまでした");
  });
});

/* ───────────────────────── 말하기 모드 ───────────────────────── */

type ResultEvent = Parameters<NonNullable<SpeechRecognitionLike["onresult"]>>[0];
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: ResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {}
  stop() {}
  abort() {}
  emitFinal(transcripts: string[]) {
    const result = Object.assign(
      transcripts.map((t) => ({ transcript: t, confidence: 0.9 })),
      { isFinal: true, length: transcripts.length },
    );
    this.onresult?.({ resultIndex: 0, results: Object.assign([result], { length: 1 }) });
  }
}
const fakeWindow = window as unknown as { webkitSpeechRecognition?: unknown };

/** 夕 시프트(레벨 3)는 직급과 무관하게 말하기 모드가 열린다 — 아침·점심을 끝낸 프로필로 연다 */
function openYoru() {
  const profile = createDefaultProfile();
  profile.today = { date: localYmd(), completed: ["asa", "hiru"] };
  useGameStore.setState({ profile });
  render(<GameScreen slot="yoru" seedOverride={SEED} />);
  fireEvent.click(screen.getByRole("button", { name: "出勤" }));
}
function mirrorYoru(): ShiftState {
  const profile = useGameStore.getState().profile;
  return createShift({
    content: konbini,
    config: konbini.shifts.yoru,
    seed: SEED,
    tagWeights: profile.tagWeights,
    regularsAvailable: availableRegulars(konbini, profile, "yoru", new Date().getMonth() + 1),
    unlockedTags: selectUnlockedTags(profile, konbini.ranks),
  });
}
const remainingLabel = () => screen.getByRole("timer").getAttribute("aria-label");

describe("GameScreen — 말하기 모드", () => {
  afterEach(() => {
    delete fakeWindow.webkitSpeechRecognition;
    FakeRecognition.instances = [];
  });

  it("음성 인식 미지원 브라우저면 말하기 버튼이 아예 없다", () => {
    clockIn();
    advance(TIMING.ENTER_MS + 60);
    expect(screen.queryByText(/말하기/)).toBeNull();
  });

  it("해금 전(新人 · 아침)엔 점선 '선배부터' 표시만", () => {
    fakeWindow.webkitSpeechRecognition = FakeRecognition;
    clockIn();
    advance(TIMING.ENTER_MS + 60);
    expect(screen.getByText(/말하기 · 선배부터/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /음성으로 답하기/ })).toBeNull();
  });

  it("夕 시프트: 마이크를 누르면 시계가 멈추고, 인식된 말이 정답이면 음성 답으로 처리된다(TTS 생략)", async () => {
    fakeWindow.webkitSpeechRecognition = FakeRecognition;
    openYoru();
    advance(TIMING.ENTER_MS + 60);
    const mirror = skip(start(mirrorYoru()));
    expect(mirror.phase).toBe("question");
    const correct = correctOf(mirror);

    fireEvent.click(screen.getByRole("button", { name: "말하기 · 음성으로 답하기" }));
    const listening = screen.getByRole("button", { name: "듣는 중" });
    expect(listening.getAttribute("aria-pressed")).toBe("true");
    const before = remainingLabel();
    advance(2000);
    expect(remainingLabel()).toBe(before); // 듣는 동안 질문 타이머 정지

    const rec = FakeRecognition.instances[0];
    expect(rec.lang).toBe("ja-JP");
    await act(async () => {
      rec.emitFinal([correct.ja.replace("？", "")]);
    });

    const target = optionButtons().find((b) => b.textContent === correct.ja);
    expect(target?.dataset.state).toBe("correct");
    expect(screen.getByText("PERFECT")).toBeTruthy();
    expect(audioMock.playSfx).toHaveBeenCalledWith("perfect");
    expect(audioMock.speakJa).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "듣는 중" })).toBeNull();
  });

  it("못 알아들으면 안내만 보이고 벌점 없이 버튼으로 이어서 답할 수 있다", async () => {
    fakeWindow.webkitSpeechRecognition = FakeRecognition;
    openYoru();
    advance(TIMING.ENTER_MS + 60);
    fireEvent.click(screen.getByRole("button", { name: "말하기 · 음성으로 답하기" }));
    await act(async () => {
      FakeRecognition.instances[0].onend?.();
    });
    expect(screen.getByText(/못 알아들었어요/)).toBeTruthy();
    const buttons = optionButtons();
    buttons.forEach((b) => {
      expect(b.dataset.state).toBe("idle");
      expect(b.disabled).toBe(false);
    });
    expect(audioMock.playSfx).not.toHaveBeenCalledWith("wrong");
  });
});
