import { describe, expect, it } from "vitest";
import { findCorrectPhrase } from "../distractor";
import {
  createShift,
  questionRemainingMs,
  shiftProgress,
  shiftReducer,
  summarize,
  TIMING,
} from "../shift";
import { initialTagWeights } from "../scheduler";
import type { ShiftConfig, ShiftState } from "../types";
import { CONTENT, REGULARS, SHIFTS } from "./fixtures";

/* ───────────────────────── 헬퍼 ───────────────────────── */

function make(config: ShiftConfig = SHIFTS.asa, seed = 7, regulars = REGULARS): ShiftState {
  return createShift({
    content: CONTENT,
    config,
    seed,
    tagWeights: initialTagWeights(),
    regularsAvailable: regulars,
    unlockedTags: [],
  });
}

const start = (s: ShiftState) => shiftReducer(s, { type: "START" }, CONTENT);
const tick = (s: ShiftState, dtMs: number) => shiftReducer(s, { type: "TICK", dtMs }, CONTENT);
const answer = (s: ShiftState, phraseId: string) => shiftReducer(s, { type: "ANSWER", phraseId }, CONTENT);
const skip = (s: ShiftState) => shiftReducer(s, { type: "SKIP_PHASE" }, CONTENT);

function correctId(s: ShiftState): string {
  const option = s.options.find((o) => o.isCorrect);
  if (!option) throw new Error("정답 선택지가 없다");
  return option.phraseId;
}
function wrongId(s: ShiftState): string {
  const option = s.options.find((o) => !o.isCorrect);
  if (!option) throw new Error("오답 선택지가 없다");
  return option.phraseId;
}

/** 지금 손님을 끝까지 정답(반응 reactMs)으로 처리해 'leave' 단계까지 간다 */
function serveCustomer(s: ShiftState, reactMs = 500): ShiftState {
  let state = s;
  for (let guard = 0; guard < 100; guard++) {
    if (state.phase === "leave" || state.phase === "done") return state;
    if (state.phase === "question") {
      state = answer(tick(state, reactMs), correctId(state));
    } else {
      state = skip(state);
    }
  }
  throw new Error("serveCustomer: 무한 루프");
}

/** 지금 손님을 오답만 골라 이탈시킨다 */
function missCustomer(s: ShiftState): ShiftState {
  let state = s;
  for (let guard = 0; guard < 100; guard++) {
    if (state.phase === "leave" || state.phase === "done") return state;
    if (state.phase === "question") {
      state = answer(tick(state, 300), wrongId(state));
    } else {
      state = skip(state);
    }
  }
  throw new Error("missCustomer: 무한 루프");
}

/** 'enter' 를 넘겨 첫 질문까지 */
const toQuestion = (s: ShiftState) => skip(start(s));

/* ───────────────────────── 테스트 ───────────────────────── */

describe("createShift", () => {
  it("START 전에는 손님이 없는 대기 상태", () => {
    const s = make();
    expect(s.started).toBe(false);
    expect(s.phase).toBe("enter");
    expect(s.customer).toBeNull();
    expect(s.phaseRemainingMs).toBe(0);
    expect(s.elapsedMs).toBe(0);
    expect(s.regularPool).toEqual(["tanaka", "yui"]);
    expect(s.activeTags).toEqual(SHIFTS.asa.activeTags);
  });

  it("해금되지 않은 alcohol/tobacco 는 activeTags 에서 빠진다", () => {
    const s = make(SHIFTS.yoru);
    expect(s.activeTags).not.toContain("alcohol");
    expect(s.activeTags).not.toContain("tobacco");
  });

  it("START 전 TICK/ANSWER/SKIP 은 무시된다", () => {
    const s = make();
    expect(tick(s, 1000)).toBe(s);
    expect(answer(s, "warm")).toBe(s);
    expect(skip(s)).toBe(s);
  });
});

describe("START", () => {
  it("손님 0 을 만들고 enter 연출을 시작한다", () => {
    const s = start(make());
    expect(s.started).toBe(true);
    expect(s.phase).toBe("enter");
    expect(s.phaseRemainingMs).toBe(TIMING.ENTER_MS);
    expect(s.customerIndex).toBe(0);
    expect(s.customer).not.toBeNull();
    expect(s.mood).toBe("neutral");
    expect(s.bubble).toBeNull();
    expect(s.irritation).toBe(0);
    expect(s.queue.length).toBeGreaterThanOrEqual(2); // TOTAL, PAY 는 항상
    expect(s.queue.map((q) => q.kind)).toContain("TOTAL");
    expect(s.queue.map((q) => q.kind)).toContain("PAY");
    expect(s.recentTagSets).toHaveLength(1);
  });

  it("큐의 모든 질문은 이 레벨에 정답 문구가 있다", () => {
    const s = start(make());
    for (const step of s.queue) {
      const phrase = findCorrectPhrase(step.kind, s.customer!, CONTENT, s.config.level);
      expect(phrase?.id).toBe(step.correctPhraseId);
    }
  });

  it("두 번 START 해도 변화 없음", () => {
    const s = start(make());
    expect(start(s)).toBe(s);
  });
});

describe("TICK — enter → question", () => {
  it("ENTER_MS 가 지나면 선택지가 생성된 question 단계", () => {
    let s = start(make());
    s = tick(s, 400);
    expect(s.phase).toBe("enter");
    expect(s.phaseRemainingMs).toBe(500);
    expect(s.elapsedMs).toBe(400);
    s = tick(s, 500);
    expect(s.phase).toBe("question");
    expect(s.options).toHaveLength(4);
    expect(s.options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(s.questionStartedAt).toBe(900);
    expect(s.stepIndex).toBe(0);
    expect(s.wrongOnStep).toBe(0);
    expect(questionRemainingMs(s)).toBe(6000);
  });

  it("questionRemainingMs 는 question 단계에서만 줄어든다", () => {
    let s = toQuestion(make());
    s = tick(s, 2500);
    expect(questionRemainingMs(s)).toBe(3500);
    expect(questionRemainingMs(start(make()))).toBe(0);
  });
});

describe("ANSWER — 정답", () => {
  it("Perfect 정답: 통계·콤보·로그·말풍선·가중치", () => {
    let s = toQuestion(make());
    const kind = s.queue[0].kind;
    const tag = { WARM: "hot", CHOPSTICKS: "chopsticks", SPOON: "spoon", SEPARATE_BAG: "hot", CAUTION_HOT: "fragile_hot", STRAW: "straw", AGE_CHECK: "alcohol" }[kind as string];
    s = answer(tick(s, 500), correctId(s));
    expect(s.phase).toBe("reply");
    expect(s.phaseRemainingMs).toBe(TIMING.REPLY_MS);
    expect(s.afterReply).toBe("advance");
    expect(s.mood).toBe("happy");
    expect(s.perfects).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.maxCombo).toBe(1);
    expect(s.log).toHaveLength(1);
    expect(s.log[0]).toMatchObject({ customerIndex: 0, kind, correct: true, grade: "perfect", reactionMs: 500, timedOut: false, attempt: 1 });
    expect(CONTENT.replies[kind]).toContainEqual(s.bubble);
    if (tag) expect(s.tagWeights[tag as "hot"]).toBeCloseTo(0.6);
  });

  it("속도 등급별 카운터", () => {
    const run = (ms: number) => {
      const s = toQuestion(make());
      return answer(tick(s, ms), correctId(s));
    };
    expect(run(1500).perfects).toBe(1);
    expect(run(2000).goods).toBe(1);
    expect(run(3000).oks).toBe(1);
    expect(run(5000).lates).toBe(1);
  });

  it("reply 가 끝나면 다음 질문 (stepIndex+1, 새 선택지)", () => {
    let s = toQuestion(make());
    const firstOptions = s.options;
    s = answer(tick(s, 500), correctId(s));
    s = tick(s, TIMING.REPLY_MS);
    expect(s.phase).toBe("question");
    expect(s.stepIndex).toBe(1);
    expect(s.options).not.toEqual(firstOptions);
    expect(s.mood).toBe("neutral");
    expect(s.bubble).toBeNull();
  });

  it("question 단계 밖의 ANSWER 는 무시", () => {
    const s = start(make());
    expect(answer(s, "warm")).toBe(s);
  });
});

describe("ANSWER — 오답과 재시도", () => {
  it("첫 오답: 당황 → 같은 질문 같은 선택지로 재시도", () => {
    let s = toQuestion(make());
    const options = s.options;
    const step = s.stepIndex;
    s = answer(tick(s, 700), wrongId(s));
    expect(s.phase).toBe("reply");
    expect(s.phaseRemainingMs).toBe(TIMING.CONFUSED_MS);
    expect(s.afterReply).toBe("retry");
    expect(s.mood).toBe("confused");
    expect(CONTENT.confusedReplies).toContainEqual(s.bubble);
    expect(s.wrongs).toBe(1);
    expect(s.wrongOnStep).toBe(1);
    expect(s.irritation).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.log[0]).toMatchObject({ correct: false, grade: null, attempt: 1, timedOut: false });

    s = tick(s, TIMING.CONFUSED_MS);
    expect(s.phase).toBe("question");
    expect(s.stepIndex).toBe(step);
    expect(s.options).toEqual(options);
    expect(s.wrongOnStep).toBe(1);
    expect(s.questionStartedAt).toBe(s.elapsedMs);
  });

  it("두 번째 오답부터 짜증 +1, 힌트 말풍선", () => {
    let s = toQuestion(make());
    s = skip(answer(tick(s, 300), wrongId(s)));
    s = answer(tick(s, 300), wrongId(s));
    expect(s.wrongOnStep).toBe(2);
    expect(s.irritation).toBe(1);
    expect(s.mood).toBe("annoyed");
    expect(s.phase).toBe("reply");
    expect(s.phaseRemainingMs).toBe(TIMING.HINT_MS);
    expect(s.afterReply).toBe("retry");
    const kind = s.queue[s.stepIndex].kind;
    const hint = CONTENT.hints[kind];
    if (hint) expect(s.bubble).toEqual(hint);
    else expect(CONTENT.confusedReplies).toContainEqual(s.bubble);
    expect(s.log[1].attempt).toBe(2);
  });

  it("오답 뒤 정답을 맞추면 attempt 가 이어지고 콤보가 다시 시작된다", () => {
    let s = toQuestion(make());
    s = skip(answer(tick(s, 300), wrongId(s)));
    s = answer(tick(s, 300), correctId(s));
    expect(s.log[1]).toMatchObject({ correct: true, attempt: 2 });
    expect(s.combo).toBe(1);
    expect(s.pendingRetryTags).toEqual([]); // 정답으로 재등장 보장 해제
  });

  it("오답은 가중치 ×2.5 와 pendingRetryTags 에 반영된다", () => {
    let s = toQuestion(make());
    const kind = s.queue[0].kind;
    s = answer(tick(s, 300), wrongId(s));
    const tag = { WARM: "hot", CHOPSTICKS: "chopsticks", SPOON: "spoon" }[kind as string] as "hot" | undefined;
    if (tag) {
      expect(s.tagWeights[tag]).toBeCloseTo(2.5);
      expect(s.pendingRetryTags).toEqual([tag]);
    } else {
      expect(s.pendingRetryTags).toEqual([]);
    }
  });

  it("짜증 게이지가 가득 차면 손님이 떠난다 (오답 5번)", () => {
    let s = toQuestion(make());
    const queueLength = s.queue.length;
    for (let i = 0; i < 4; i++) {
      s = skip(answer(tick(s, 300), wrongId(s)));
      expect(s.phase).toBe("question");
    }
    expect(s.irritation).toBe(3);
    s = answer(tick(s, 300), wrongId(s));
    expect(s.irritation).toBe(4);
    expect(s.phase).toBe("leave");
    expect(s.phaseRemainingMs).toBe(TIMING.LEAVE_MS);
    expect(s.mood).toBe("gone");
    expect(CONTENT.leaveReplies).toContainEqual(s.bubble);
    expect(s.missed).toBe(1);
    expect(s.consecutiveMissed).toBe(1);
    expect(s.served).toBe(0);
    expect(s.wrongs).toBe(5);
    // 남은 질문은 기록되지 않는다
    expect(s.log).toHaveLength(5);
    expect(queueLength).toBeGreaterThan(1);
  });

  it("레귤러의 patienceBonus 만큼 더 참는다", () => {
    // regularPool 에 tanaka 만, seed 를 바꿔 레귤러가 나오는 경우를 찾는다
    let found: ShiftState | null = null;
    for (let seed = 0; seed < 200 && !found; seed++) {
      const s = start(make(SHIFTS.asa, seed, [REGULARS[0]]));
      if (s.customer?.regularId === "tanaka") found = s;
    }
    expect(found).not.toBeNull();
    expect(found!.customer!.patienceMax).toBe(5);
    expect(found!.regularsMet).toEqual(["tanaka"]);
    expect(found!.customer!.items.map((i) => i.id)).toEqual(["onigiri", "water"]);
    let s = skip(found!);
    for (let i = 0; i < 5; i++) s = skip(answer(tick(s, 300), wrongId(s)));
    expect(s.phase).toBe("question");
    expect(s.irritation).toBe(4);
    s = answer(tick(s, 300), wrongId(s));
    expect(s.phase).toBe("leave");
    expect(s.mood).toBe("gone");
  });
});

describe("TICK — 시간 초과", () => {
  it("제한 시간이 지나면 오답으로 처리된다 (timedOut, chosen null)", () => {
    let s = toQuestion(make());
    s = tick(s, 5999);
    expect(s.phase).toBe("question");
    s = tick(s, 1);
    expect(s.phase).toBe("reply");
    expect(s.mood).toBe("confused");
    expect(s.wrongs).toBe(1);
    expect(s.log[0]).toMatchObject({ correct: false, timedOut: true, chosenPhraseId: null, reactionMs: 6000, attempt: 1 });
  });
});

describe("SKIP_PHASE", () => {
  it("enter/reply/leave 를 즉시 끝낸다, question/done 에서는 무시", () => {
    let s = start(make());
    s = skip(s);
    expect(s.phase).toBe("question");
    expect(skip(s)).toBe(s);
    s = answer(tick(s, 500), correctId(s));
    expect(s.phase).toBe("reply");
    s = skip(s);
    expect(s.phase).toBe("question");
    expect(s.stepIndex).toBe(1);
  });
});

describe("손님 교체와 종료", () => {
  it("모든 질문을 맞추면 served+1, happy, leave → 다음 손님 enter", () => {
    let s = start(make());
    s = serveCustomer(s);
    expect(s.phase).toBe("leave");
    expect(s.mood).toBe("happy");
    expect(s.served).toBe(1);
    expect(s.consecutiveMissed).toBe(0);
    expect(s.log).toHaveLength(s.queue.length);
    expect(shiftProgress(s)).toBeCloseTo(1 / 3);

    s = tick(s, TIMING.LEAVE_MS);
    expect(s.phase).toBe("enter");
    expect(s.customerIndex).toBe(1);
    expect(s.irritation).toBe(0);
    expect(s.stepIndex).toBe(0);
    expect(s.recentTagSets).toHaveLength(2);
  });

  it("손님 수를 다 처리하면 endedBy 'customers'", () => {
    let s = start(make());
    for (let i = 0; i < 3; i++) s = skip(serveCustomer(s));
    expect(s.phase).toBe("done");
    expect(s.endedBy).toBe("customers");
    expect(s.served).toBe(3);
    expect(shiftProgress(s)).toBe(1);
    // done 이후 이벤트는 무시
    expect(tick(s, 1000)).toBe(s);
    expect(skip(s)).toBe(s);
  });

  it("연속 3명 이탈 → 'manager'", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 6 }));
    s = skip(missCustomer(s));
    expect(s.phase).toBe("enter");
    expect(s.consecutiveMissed).toBe(1);
    s = skip(missCustomer(s));
    expect(s.consecutiveMissed).toBe(2);
    s = skip(missCustomer(s));
    expect(s.phase).toBe("done");
    expect(s.endedBy).toBe("manager");
    expect(s.missed).toBe(3);
    expect(s.customerIndex).toBe(2);
  });

  it("이탈 사이에 응대가 끼면 연속 이탈이 리셋된다", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 6 }));
    s = skip(missCustomer(s));
    s = skip(missCustomer(s));
    s = skip(serveCustomer(s));
    expect(s.consecutiveMissed).toBe(0);
    s = skip(missCustomer(s));
    expect(s.phase).toBe("enter");
    expect(s.consecutiveMissed).toBe(1);
  });

  it("시간이 다 되면 현재 손님을 마친 뒤 'time'", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 10, durationSec: 2 }));
    s = serveCustomer(s, 1000);
    expect(s.elapsedMs).toBeGreaterThanOrEqual(2000);
    s = skip(s);
    expect(s.phase).toBe("done");
    expect(s.endedBy).toBe("time");
  });

  it("recentTagSets 는 직전 3명만 유지", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 10, durationSec: 9999 }));
    for (let i = 0; i < 5; i++) s = skip(serveCustomer(s));
    expect(s.customerIndex).toBe(5);
    expect(s.recentTagSets).toHaveLength(3);
  });
});

describe("결정성", () => {
  it("같은 seed·같은 입력 → 같은 상태", () => {
    const script = (seed: number) => {
      let s = start(make(SHIFTS.asa, seed));
      s = skip(missCustomer(s));
      s = skip(serveCustomer(s, 2000));
      s = tick(s, 123);
      return s;
    };
    expect(script(99)).toEqual(script(99));
    // 다른 seed 는 최소한 손님 구성이 어딘가 다르다
    const items = (seed: number) => start(make(SHIFTS.asa, seed)).customer!.items.map((i) => i.id).join(",");
    const variety = new Set(Array.from({ length: 10 }, (_, i) => items(i)));
    expect(variety.size).toBeGreaterThan(1);
  });

  it("TICK 간격이 달라도 손님·선택지는 같다", () => {
    const a = tick(tick(start(make(SHIFTS.asa, 5)), 300), 600);
    const b = tick(start(make(SHIFTS.asa, 5)), 900);
    expect(a.customer).toEqual(b.customer);
    expect(a.options).toEqual(b.options);
  });
});

describe("summarize", () => {
  const ctx = { workplaceId: "konbini" as const, wageBefore: 1000, perfectedTags: [] as never[], playedAt: "2026-03-10T07:00:00Z" };

  it("숫자가 맞아 떨어진다", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 4, durationSec: 9999 }));
    s = skip(serveCustomer(s, 500)); // 전부 perfect
    s = skip(missCustomer(s));
    s = skip(serveCustomer(s, 3000)); // 전부 ok
    // 마지막 손님: 한 번 틀리고 늦게 맞춤
    s = skip(s); // enter → question
    s = skip(answer(tick(s, 300), wrongId(s)));
    s = answer(tick(s, 5000), correctId(s));
    s = skip(serveCustomer(s, 500));
    expect(s.phase).toBe("done");

    const sum = summarize(s, ctx);
    expect(sum.served + sum.missed).toBe(4);
    expect(sum.served).toBe(3);
    expect(sum.missed).toBe(1);
    expect(sum.questionCount).toBe(s.log.length);
    const correct = s.log.filter((l) => l.correct).length;
    expect(sum.perfects + sum.goods + sum.oks + sum.lates).toBe(correct);
    expect(sum.wrongs).toBe(s.log.filter((l) => !l.correct).length);
    expect(sum.lates).toBe(1);
    expect(sum.endedBy).toBe("customers");
    expect(sum.durationMs).toBe(s.elapsedMs);
    expect(sum.slot).toBe("asa");
    expect(sum.answers).toBe(s.log);

    // 가장 헷갈린 문구 = (kind, 정답 id) 별 오답+Late 최다. 이탈 손님의 첫 질문만으로도 5 이상이다
    expect(sum.hardest).not.toBeNull();
    const score = (kind: string, id: string) =>
      s.log.filter((l) => l.kind === kind && l.correctPhraseId === id && (!l.correct || l.grade === "late")).length;
    const maxScore = Math.max(...s.log.map((l) => score(l.kind, l.correctPhraseId)));
    expect(sum.hardest!.wrongCount + sum.hardest!.lateCount).toBe(maxScore);
    expect(maxScore).toBeGreaterThanOrEqual(5);
    expect(sum.hardest!.wrongCount).toBe(
      s.log.filter((l) => l.kind === sum.hardest!.kind && l.correctPhraseId === sum.hardest!.phraseId && !l.correct).length,
    );

    // 첫 Perfect 태그: perfectedTags 가 비어 있으니 perfect 가 난 태그 전부
    const perfectKinds = s.log.filter((l) => l.grade === "perfect").map((l) => l.kind);
    for (const tag of sum.firstSuccessTags) {
      expect(["hot", "chopsticks", "spoon", "straw", "alcohol", "fragile_hot"]).toContain(tag);
    }
    expect(perfectKinds.length).toBeGreaterThan(0);

    // 시급 변동
    const expected = Math.max(-80, Math.min(160, sum.perfects * 4 + sum.goods * 2 + sum.oks - sum.wrongs - sum.missed * 25 + sum.maxCombo * 2 + sum.firstSuccessTags.length * 40));
    expect(sum.wageDelta).toBe(expected);
    expect(sum.wageAfter).toBe(Math.max(900, 1000 + expected));
  });

  it("perfectedTags 에 이미 있는 태그는 firstSuccessTags 에서 빠진다", () => {
    let s = start(make());
    for (let i = 0; i < 3; i++) s = skip(serveCustomer(s, 500));
    const all = summarize(s, ctx).firstSuccessTags;
    const some = summarize(s, { ...ctx, perfectedTags: all }).firstSuccessTags;
    expect(some).toEqual([]);
  });

  it("시급은 900 아래로 내려가지 않는다", () => {
    let s = start(make({ ...SHIFTS.asa, customerCount: 6 }));
    for (let i = 0; i < 3; i++) s = skip(missCustomer(s));
    const sum = summarize(s, { ...ctx, wageBefore: 920 });
    expect(sum.endedBy).toBe("manager");
    expect(sum.wageDelta).toBe(-80);
    expect(sum.wageAfter).toBe(900);
  });

  it("오답·Late 가 없으면 hardest 는 null", () => {
    let s = start(make());
    for (let i = 0; i < 3; i++) s = skip(serveCustomer(s, 500));
    expect(summarize(s, ctx).hardest).toBeNull();
  });
});
