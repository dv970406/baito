/**
 * Lv4 확장 기능 — 돌발 이벤트 · 담배 번호 매칭 · 리스닝 전용 · 가려진 선택지 · 시즌 규칙 · 승급 시험.
 * fixtures 의 최소 콘텐츠 위에 이 파일 안에서만 쓰는 문구/상품을 얹어 검증한다(fixtures 는 그대로 둔다).
 */
import { describe, expect, it } from "vitest";
import { buildOptions, isSyntheticPhraseId, listenId, maskJa, tobaccoPickId } from "../distractor";
import { examAvailability, examPassed, weekStartOf } from "../progression";
import { createShift, currentPrompt, shiftReducer, stepTag, summarize } from "../shift";
import { eligibleItems, generateCustomer, initialTagWeights } from "../scheduler";
import { createRng } from "../rng";
import type { Item, Phrase, ShiftConfig, ShiftState, WorkplaceContent } from "../types";
import { CONTENT, ITEMS, SHIFTS, customerOf } from "./fixtures";

/* ───────────────────────── 이 파일 전용 콘텐츠 ───────────────────────── */

const visual = { shape: "box", color: "#888" } as const;
const cigarettes: Item = { ...ITEMS.cigarettes, code: "23" };
const sakuraMochi: Item = { id: "sakura", ja: "桜もち", ko: "사쿠라모치", price: 160, tags: ["cold"], level: 1, visual, season: 3 };

const EXTRA_PHRASES: Phrase[] = [
  { id: "tobacco.num", kind: "TOBACCO_NUMBER", category: "counter", ja: "番号をお願いします", ko: "번호 말씀해 주세요", level: 3 },
  { id: "bagsize", kind: "BAG_SIZE", category: "bag", ja: "袋のサイズはどうしますか？", ko: "봉투 사이즈는요?", level: 1 },
  { id: "receipt", kind: "RECEIPT_ASK", category: "payment", ja: "レシートはご入り用ですか？", ko: "영수증 필요하세요?", level: 1 },
  { id: "dir.right", kind: "DIRECTIONS", direction: "right", category: "service", ja: "右です", ko: "오른쪽이에요", level: 3 },
  { id: "dir.left", kind: "DIRECTIONS", direction: "left", category: "service", ja: "左です", ko: "왼쪽이에요", level: 3 },
  { id: "dir.straight", kind: "DIRECTIONS", direction: "straight", category: "service", ja: "まっすぐです", ko: "직진이에요", level: 3 },
  { id: "dir.back", kind: "DIRECTIONS", direction: "back", category: "service", ja: "後ろです", ko: "뒤쪽이에요", level: 3 },
  { id: "toilet", kind: "TOILET", category: "service", ja: "奥にございます", ko: "안쪽에 있어요", level: 3 },
  { id: "copier", kind: "COPIER", category: "service", ja: "少々お待ちください", ko: "잠시만요", level: 3 },
  { id: "atm", kind: "ATM", category: "service", ja: "こちらをタッチしてください", ko: "여기를 눌러 주세요", level: 3 },
  { id: "delivery", kind: "DELIVERY", category: "service", ja: "伝票にご記入ください", ko: "전표에 적어 주세요", level: 3 },
  { id: "utility", kind: "UTILITY_BILL", category: "service", ja: "払込票をお預かりします", ko: "납부서 받았습니다", level: 3 },
  { id: "ticket", kind: "TICKET", category: "service", ja: "予約番号をお願いします", ko: "예약 번호 부탁해요", level: 3 },
];

const FULL: WorkplaceContent = {
  ...CONTENT,
  items: [...CONTENT.items.filter((i) => i.id !== "cigarettes"), cigarettes, sakuraMochi],
  phrases: [...CONTENT.phrases, ...EXTRA_PHRASES],
  seasons: [
    { month: 3, nameJa: "春", nameKo: "봄", posterJa: "桜もち", rule: { kind: "bagSize" } },
    { month: 6, nameJa: "ポイント祭", nameKo: "포인트 축제", posterJa: "P2倍", rule: { kind: "pointCardAlways" } },
    { month: 9, nameJa: "レシート", nameKo: "영수증", posterJa: "レシート", rule: { kind: "receiptAsk" } },
  ],
};

function make(config: ShiftConfig, opts: Partial<Parameters<typeof createShift>[0]> = {}, seed = 11): ShiftState {
  const content = opts.content ?? FULL;
  return tag(
    createShift({
      content,
      config,
      seed,
      tagWeights: initialTagWeights(),
      regularsAvailable: [],
      unlockedTags: ["alcohol", "tobacco"],
      ...opts,
    }),
    content,
  );
}
/** 리듀서는 state 가 아닌 인자로 받은 콘텐츠로 손님을 만든다 — 시프트를 만든 콘텐츠를 똑같이 넘겨야 한다 */
const contentOf = new WeakMap<ShiftState, WorkplaceContent>();
function tag(state: ShiftState, content: WorkplaceContent): ShiftState {
  contentOf.set(state, content);
  return state;
}
const reduce = (s: ShiftState, event: Parameters<typeof shiftReducer>[1]) => {
  const content = contentOf.get(s) ?? FULL;
  return tag(shiftReducer(s, event, content), content);
};
const start = (s: ShiftState) => reduce(s, { type: "START" });
const tick = (s: ShiftState, dtMs: number) => reduce(s, { type: "TICK", dtMs });
const answer = (s: ShiftState, id: string) => reduce(s, { type: "ANSWER", phraseId: id });
const skip = (s: ShiftState) => reduce(s, { type: "SKIP_PHASE" });
const correctId = (s: ShiftState) => {
  const o = s.options.find((x) => x.isCorrect);
  if (!o) throw new Error("정답 없음");
  return o.phraseId;
};
const wrongId = (s: ShiftState) => {
  const o = s.options.find((x) => !x.isCorrect);
  if (!o) throw new Error("오답 없음");
  return o.phraseId;
};
/** 지금 손님을 끝까지 처리(정답 또는 오답만) */
function runCustomer(s: ShiftState, pick: (s: ShiftState) => string): ShiftState {
  let state = s;
  for (let guard = 0; guard < 200; guard++) {
    if (state.phase === "leave" || state.phase === "done") return state;
    state = state.phase === "question" ? answer(tick(state, 400), pick(state)) : skip(state);
  }
  throw new Error("runCustomer: 무한 루프");
}
function runShift(s: ShiftState, pick: (s: ShiftState) => string, missEvery = 0): ShiftState {
  let state = start(s);
  for (let i = 0; state.phase !== "done" && i < 50; i++) {
    const miss = missEvery > 0 && i % missEvery === missEvery - 1;
    state = runCustomer(state, miss ? wrongId : pick);
    if (state.phase === "leave") state = skip(state);
  }
  return state;
}

/* ───────────────────────── 돌발 이벤트 ───────────────────────── */

describe("돌발 이벤트 손님", () => {
  const eventConfig: ShiftConfig = { ...SHIFTS.yoru, eventChance: 1, customerCount: 4 };

  it("Lv3 부터 물건 없이 와서 이벤트 질문 하나만 받고, 첫마디가 말풍선 prompt 로 붙는다", () => {
    const s = skip(start(make(eventConfig)));
    expect(s.customer?.event).not.toBeNull();
    expect(s.customer?.items).toEqual([]);
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0].kind).toBe(s.customer?.event);
    expect(currentPrompt(s)?.ja).toBeTruthy();
    expect(s.options.length).toBe(4);
  });

  it("길 묻기는 방향 4개가 선택지, 손님의 direction 이 정답", () => {
    const rng = createRng(3);
    const customer = customerOf([], { event: "DIRECTIONS", direction: "left" });
    const options = buildOptions({ kind: "DIRECTIONS", correctPhraseId: "dir.left" }, {
      content: FULL, customer, queue: ["DIRECTIONS"], level: 3, rng,
    });
    expect(options.map((o) => o.phraseId).sort()).toEqual(["dir.back", "dir.left", "dir.right", "dir.straight"]);
    expect(options.find((o) => o.isCorrect)?.phraseId).toBe("dir.left");
  });

  it("Lv2 에서는 이벤트가 나오지 않는다", () => {
    const s = skip(start(make({ ...SHIFTS.hiru, eventChance: 1 })));
    expect(s.customer?.event).toBeNull();
  });

  it("처리한 이벤트 수가 요약 events 에 집계된다", () => {
    const done = runShift(make(eventConfig), correctId);
    const summary = summarize(done, { workplaceId: "konbini", wageBefore: 1000, perfectedTags: [], playedAt: "2026-11-11T00:00:00Z" });
    expect(summary.events).toBe(4);
    expect(summary.served).toBe(4);
  });
});

/* ───────────────────────── 담배 번호 매칭 ───────────────────────── */

describe("담배 번호 매칭", () => {
  const tobaccoOnly: WorkplaceContent = { ...FULL, items: [cigarettes] };

  it("code 있는 담배를 사면 tobaccoNumber 가 채워지고 TOBACCO_NUMBER → TOBACCO_PICK 큐가 생긴다", () => {
    const s = skip(start(make({ ...SHIFTS.yoru, itemsPerCustomer: [1, 1] }, { content: tobaccoOnly })));
    expect(s.customer?.tobaccoNumber).toBe("23");
    const kinds = s.queue.map((q) => q.kind);
    expect(kinds.indexOf("TOBACCO_NUMBER")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("TOBACCO_PICK")).toBeGreaterThan(kinds.indexOf("TOBACCO_NUMBER"));
    const pick = s.queue.find((q) => q.kind === "TOBACCO_PICK");
    expect(pick?.correctPhraseId).toBe(tobaccoPickId("23"));
    expect(pick?.prompt?.ja).toContain("23");
  });

  it("번호 선택지는 정답 1 + 비슷한 번호 3, 전부 합성 id", () => {
    const customer = customerOf([cigarettes], { tobaccoNumber: "23" });
    const options = buildOptions({ kind: "TOBACCO_PICK", correctPhraseId: tobaccoPickId("23") }, {
      content: FULL, customer, queue: ["TOBACCO_PICK"], level: 3, rng: createRng(1),
    });
    expect(options).toHaveLength(4);
    expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(new Set(options.map((o) => o.ja)).size).toBe(4);
    for (const o of options) expect(isSyntheticPhraseId(o.phraseId)).toBe(true);
  });
});

/* ───────────────────────── 리스닝 전용 ───────────────────────── */

describe("리스닝 전용 문제(LISTEN)", () => {
  const listenConfig: ShiftConfig = { ...SHIFTS.hiru, listenChance: 1 };
  const bentoOnly: WorkplaceContent = { ...FULL, items: [ITEMS.bento] };

  it("Lv2 부터 WARM/CHOPSTICKS 류 질문 하나가 손님의 요구(LISTEN)로 바뀌고 아이콘 선택지가 뜬다", () => {
    const s = skip(start(make(listenConfig, { content: bentoOnly })));
    const listen = s.queue.find((q) => q.kind === "LISTEN");
    expect(listen).toBeDefined();
    expect(listen?.target).toMatch(/WARM|CHOPSTICKS/);
    expect(listen?.correctPhraseId).toBe(listenId(listen!.target!));
    expect(listen?.prompt?.ja).toBeTruthy();
    // 원래 질문으로 태그를 센다
    expect(stepTag(listen!)).toBe(listen?.target === "WARM" ? "hot" : "chopsticks");
  });

  it("LISTEN 선택지는 아이콘 4개, 정답은 target 아이콘", () => {
    const customer = customerOf([ITEMS.bento]);
    const options = buildOptions({ kind: "LISTEN", target: "WARM", correctPhraseId: listenId("WARM") }, {
      content: FULL, customer, queue: ["LISTEN"], level: 2, rng: createRng(5),
    });
    expect(options).toHaveLength(4);
    for (const o of options) expect(o.icon).toBeTruthy();
    expect(options.find((o) => o.isCorrect)?.phraseId).toBe(listenId("WARM"));
  });

  it("Lv1 에서는 LISTEN 치환이 없다", () => {
    const s = skip(start(make({ ...SHIFTS.asa, listenChance: 1 }, { content: bentoOnly })));
    expect(s.queue.some((q) => q.kind === "LISTEN")).toBe(false);
  });
});

/* ───────────────────────── 가려진 선택지 ───────────────────────── */

describe("가려진 선택지(masked)", () => {
  it("maskJa 는 한자만 〇 로 바꾼다", () => {
    expect(maskJa("温めますか？")).toBe("〇めますか？");
    expect(maskJa("レジ袋はご利用ですか？")).toBe("レジ〇はご〇〇ですか？");
    expect(maskJa("ストロー")).toBe("ストロー");
  });

  it("Lv2 + maskChance 1 이면 한자 있는 선택지 하나가 가려진다, Lv1 은 절대 안 가린다", () => {
    const customer = customerOf([ITEMS.bento]);
    const step = { kind: "WARM" as const, correctPhraseId: "warm" };
    const lv2 = buildOptions(step, { content: FULL, customer, queue: ["WARM"], level: 2, rng: createRng(2), maskChance: 1 });
    const masked = lv2.filter((o) => o.masked);
    // 엔진은 플래그만 세우고 원문 ja 는 보존한다(말하기 매칭·TTS 용). 〇 처리는 화면이 maskJa 로 한다
    expect(masked.length).toBe(1);
    for (const o of masked) {
      expect(o.ja).not.toContain("〇");
      expect(maskJa(o.ja)).toContain("〇");
    }
    const lv1 = buildOptions(step, { content: FULL, customer, queue: ["WARM"], level: 1, rng: createRng(2), maskChance: 1 });
    expect(lv1.some((o) => o.masked)).toBe(false);
  });
});

/* ───────────────────────── 시즌 ───────────────────────── */

describe("시즌 규칙과 한정 상품", () => {
  const twoItems: ShiftConfig = { ...SHIFTS.asa, itemsPerCustomer: [2, 2], pointCardChance: 0 };

  it("시즌 한정 상품은 그 달에만 등장한다", () => {
    const tags = SHIFTS.asa.activeTags;
    expect(eligibleItems(FULL.items, 1, tags, 3).some((i) => i.id === "sakura")).toBe(true);
    expect(eligibleItems(FULL.items, 1, tags, 4).some((i) => i.id === "sakura")).toBe(false);
    expect(eligibleItems(FULL.items, 1, tags).some((i) => i.id === "sakura")).toBe(false);
  });

  it("month 로 시즌이 붙고, bagSize 규칙이면 BAG 뒤에 BAG_SIZE", () => {
    const s = skip(start(make(twoItems, { month: 3 })));
    expect(s.season?.month).toBe(3);
    const kinds = s.queue.map((q) => q.kind);
    expect(kinds).toContain("BAG");
    expect(kinds.indexOf("BAG_SIZE")).toBe(kinds.indexOf("BAG") + 1);
  });

  it("pointCardAlways 면 확률 0 이어도 POINT_CARD 가 항상 들어간다", () => {
    const s = skip(start(make({ ...twoItems, level: 2 }, { month: 6 })));
    expect(s.queue.map((q) => q.kind)).toContain("POINT_CARD");
  });

  it("receiptAsk 면 PAY 뒤에 RECEIPT_ASK", () => {
    const s = skip(start(make(twoItems, { month: 9 })));
    const kinds = s.queue.map((q) => q.kind);
    expect(kinds.indexOf("RECEIPT_ASK")).toBe(kinds.indexOf("PAY") + 1);
  });

  it("시즌이 없는 달은 season null, 규칙 질문 없음", () => {
    const s = skip(start(make(twoItems, { month: 11 })));
    expect(s.season).toBeNull();
    expect(s.queue.map((q) => q.kind)).not.toContain("BAG_SIZE");
  });

  it("generateCustomer 도 month 를 받아 시즌 상품을 섞는다", () => {
    const rng = createRng(9);
    const ctx = {
      content: { ...FULL, items: [sakuraMochi, ITEMS.gum] }, config: SHIFTS.asa, index: 0, rng,
      tagWeights: initialTagWeights(), recentTagSets: [], pendingRetryTags: [], regularsAvailable: [], regularsAlreadyMet: [],
    };
    const inMarch = generateCustomer({ ...ctx, month: 3 });
    expect(inMarch.items.length).toBeGreaterThan(0);
    const inMay = generateCustomer({ ...ctx, month: 5, rng: createRng(9) });
    expect(inMay.items.every((i) => i.id === "gum")).toBe(true);
  });
});

/* ───────────────────────── 승급 시험 ───────────────────────── */

describe("승급 시험(점장 점검 시프트)", () => {
  const exam = { rank: "ippan" as const, comboRequired: 3 };
  const config: ShiftConfig = { ...SHIFTS.asa, customerCount: 3, itemsPerCustomer: [1, 2] };

  it("전부 응대하고 콤보 기준을 넘기면 합격", () => {
    const done = runShift(make(config, { exam }), correctId);
    expect(done.exam).toEqual(exam);
    const summary = summarize(done, { workplaceId: "konbini", wageBefore: 1000, perfectedTags: [], playedAt: "2026-11-11T00:00:00Z" });
    expect(summary.exam).toEqual({ rank: "ippan", comboRequired: 3, passed: true });
    expect(summary.missed).toBe(0);
    expect(summary.maxCombo).toBeGreaterThanOrEqual(3);
  });

  it("한 명이라도 이탈하면 콤보가 충분해도 불합격", () => {
    const done = runShift(make(config, { exam }), correctId, 3);
    const summary = summarize(done, { workplaceId: "konbini", wageBefore: 1000, perfectedTags: [], playedAt: "2026-11-11T00:00:00Z" });
    expect(summary.missed).toBeGreaterThan(0);
    expect(summary.exam?.passed).toBe(false);
    expect(examPassed(summary, { slot: "asa", combo: 3 })).toBe(false);
  });

  it("시험이 아니면 summary.exam 은 null", () => {
    const done = runShift(make(config), correctId);
    const summary = summarize(done, { workplaceId: "konbini", wageBefore: 1000, perfectedTags: [], playedAt: "2026-11-11T00:00:00Z" });
    expect(summary.exam).toBeNull();
  });

  it("주 1회 — 같은 주에 봤으면 available false, 다음 주 월요일부터 다시", () => {
    const ranks = CONTENT.ranks.map((r) => (r.id === "ippan" ? { ...r, exam: { slot: "asa" as const, combo: 3 } } : r));
    const monday = weekStartOf("2026-11-11");
    expect(monday).toBe("2026-11-09");
    const base = { rank: "shinjin" as const, totalShifts: 3, examWeek: null };
    expect(examAvailability(base, ranks, monday)).toMatchObject({ ready: true, takenThisWeek: false, available: true });
    expect(examAvailability({ ...base, examWeek: monday }, ranks, monday)).toMatchObject({ takenThisWeek: true, available: false });
    expect(examAvailability({ ...base, examWeek: monday }, ranks, weekStartOf("2026-11-16")).available).toBe(true);
    expect(examAvailability({ ...base, totalShifts: 2 }, ranks, monday).available).toBe(false);
  });
});

/* ───────────────────────── 단골 고정 구매 ───────────────────────── */

describe("단골 고정 구매는 레벨과 무관", () => {
  const smoker = {
    ...CONTENT.regulars[0],
    id: "smoker",
    slots: ["asa" as const],
    purchase: ["cigarettes", "water"],
    lines: [],
    firstWords: [],
  };
  // 리듀서는 단골 정보를 content.regulars 에서 찾으므로 콘텐츠에도 넣는다
  const WITH_SMOKER: WorkplaceContent = { ...FULL, regulars: [...FULL.regulars, smoker] };
  const asaWithTobacco: ShiftConfig = { ...SHIFTS.asa, activeTags: [...SHIFTS.asa.activeTags, "tobacco"] };

  it("직급으로 담배가 해금됐으면 아침(Lv1)에도 단골은 Lv3 담배를 사고, 가장 쉬운 문구로 묻는다", () => {
    const rng = createRng(1);
    const customer = generateCustomer({
      content: FULL, config: asaWithTobacco, index: 0, rng, tagWeights: initialTagWeights(),
      recentTagSets: [], pendingRetryTags: [], regularsAvailable: [smoker], regularsAlreadyMet: [],
      regularChance: 1, activeTags: ["hot", "cold", "chopsticks", "spoon", "tobacco"],
    });
    expect(customer.regularId).toBe("smoker");
    expect(customer.items.map((i) => i.id)).toContain("cigarettes");
    expect(customer.tobaccoNumber).toBe("23");

    // 단골이 첫 손님으로 오는 시드를 찾는다(결정적)
    let state = skip(start(make(asaWithTobacco, { content: WITH_SMOKER, regularsAvailable: [smoker], unlockedTags: ["tobacco"] }, 1)));
    for (let seed = 2; seed < 200 && state.customer?.regularId !== "smoker"; seed++) {
      state = skip(start(make(asaWithTobacco, { content: WITH_SMOKER, regularsAvailable: [smoker], unlockedTags: ["tobacco"] }, seed)));
    }
    expect(state.customer?.regularId).toBe("smoker");
    const kinds = state.queue.map((q) => q.kind);
    expect(kinds).toContain("AGE_CHECK");
    expect(kinds).toContain("TOBACCO_PICK");
  });

  it("해금 전이면 단골도 담배를 사지 않는다", () => {
    const customer = generateCustomer({
      content: FULL, config: asaWithTobacco, index: 0, rng: createRng(1), tagWeights: initialTagWeights(),
      recentTagSets: [], pendingRetryTags: [], regularsAvailable: [smoker], regularsAlreadyMet: [],
      regularChance: 1, activeTags: ["hot", "cold", "chopsticks", "spoon"],
    });
    expect(customer.items.map((i) => i.id)).not.toContain("cigarettes");
  });
});

/* ───────────────────────── 취객 대사 ───────────────────────── */

describe("취객 전용 대사", () => {
  const DRUNK_CONTENT: WorkplaceContent = {
    ...FULL,
    drunkReplies: {
      reply: [{ ja: "うぃ〜", ko: "으이~" }],
      confused: [{ ja: "あぁ？", ko: "어?" }],
      leave: [{ ja: "帰るわ〜", ko: "간다~" }],
    },
  };
  const drunkShift: ShiftConfig = { ...SHIFTS.shinya, drunkChance: 1, eventChance: 0, touristChance: 0, customerCount: 2 };

  it("취객이 첫 오답에 당황하면 전용 대사, 짜증이 차서 나가면 전용 이탈 대사", () => {
    let s = skip(start(make(drunkShift, { content: DRUNK_CONTENT })));
    expect(s.customer?.drunk).toBe(true);
    s = answer(tick(s, 300), wrongId(s));
    expect(s.bubble?.ja).toBe("あぁ？");
    // 짜증이 찰 때까지 계속 틀린다
    for (let i = 0; i < 20 && s.phase !== "leave"; i++) {
      s = s.phase === "question" ? answer(tick(s, 300), wrongId(s)) : skip(s);
    }
    expect(s.mood).toBe("gone");
    expect(s.bubble?.ja).toBe("帰るわ〜");
  });

  it("정답 뒤 반응은 원래 응답과 전용 대사가 섞인다", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      let s = skip(start(make(drunkShift, { content: DRUNK_CONTENT }, seed)));
      s = answer(tick(s, 300), correctId(s));
      if (s.bubble) seen.add(s.bubble.ja === "うぃ〜" ? "drunk" : "normal");
    }
    expect(seen).toEqual(new Set(["drunk", "normal"]));
  });

  it("취객이 아니면 전용 대사를 쓰지 않는다", () => {
    let s = skip(start(make({ ...drunkShift, drunkChance: 0 }, { content: DRUNK_CONTENT })));
    s = answer(tick(s, 300), wrongId(s));
    expect(s.bubble?.ja).not.toBe("あぁ？");
  });
});
