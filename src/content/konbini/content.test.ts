import { describe, expect, it } from "vitest";
import {
  DIRECTIONS,
  EVENT_KINDS,
  ITEM_TAGS,
  LISTEN_TARGETS,
  QUESTION_KINDS,
  PAYMENT_METHODS,
  QUESTION_ORDER,
  SHIFT_SLOTS,
  type ItemTag,
  type PaymentMethod,
  type PhraseCategory,
  type QuestionKind,
} from "@/engine/types";
import { konbini } from "./index";

/** 콘텐츠 린트: 엔진이 전제하는 데이터 불변식을 검사한다. */

/** 질문 종류가 처음 등장하는 레벨 (이 레벨 이하의 정답 문구가 반드시 하나 있어야 한다) */
const KIND_MIN_LEVEL: Record<QuestionKind, number> = {
  WARM: 1,
  BAG: 1,
  CHOPSTICKS: 1,
  TOTAL: 1,
  PAY: 1,
  POINT_CARD: 2,
  SEPARATE_BAG: 2,
  SPOON: 2,
  STRAW: 2,
  CAUTION_HOT: 2,
  AGE_CHECK: 3,
  TOBACCO_NUMBER: 3,
  // 합성 선택지(콘텐츠 문구 없음)
  TOBACCO_PICK: 0,
  LISTEN: 0,
  BAG_SIZE: 1,
  RECEIPT_ASK: 1,
  ODEN_COUNT: 4,
  KARASHI: 4,
  SAUCE: 4,
  DIRECTIONS: 3,
  TOILET: 3,
  COPIER: 3,
  ATM: 3,
  DELIVERY: 3,
  UTILITY_BILL: 3,
  TICKET: 3,
};

/** 근접 오답 생성용 카테고리 — 정답·오답 각 2개 이상이어야 하는 것들 */
const CATEGORIES: PhraseCategory[] = [
  "age",
  "point",
  "temperature",
  "bag",
  "utensil",
  "amount",
  "payment",
  "caution",
  "greeting",
  "service",
  "counter",
];

const KANJI = /[一-龯々]/;
const HEX = /^#[0-9A-Fa-f]{6}$/;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dups.add(v);
    seen.add(v);
  }
  return [...dups];
}

describe("KONBINI 콘텐츠 린트", () => {
  const {
    items,
    phrases,
    regulars,
    manager,
    ranks,
    shifts,
    replies,
    hints,
    confusedReplies,
    leaveReplies,
    listenRequests,
    listenTargets,
    eventPrompts,
    tobaccoRequests,
    seasons,
  } = konbini;

  describe("상품", () => {
    it("60개 이상, id 는 유일", () => {
      expect(items.length).toBeGreaterThanOrEqual(60);
      expect(duplicates(items.map((i) => i.id))).toEqual([]);
    });

    it("태그는 ITEM_TAGS 에 있는 값만, 중복 없음, 태그마다 상품 4개 이상", () => {
      for (const item of items) {
        for (const tag of item.tags) expect(ITEM_TAGS).toContain(tag);
        expect(duplicates(item.tags)).toEqual([]);
      }
      for (const tag of ITEM_TAGS) {
        expect(items.filter((i) => i.tags.includes(tag)).length, tag).toBeGreaterThanOrEqual(4);
      }
    });

    it("레벨 1 상품은 hot / chopsticks 태그만 쓴다", () => {
      const allowed: ItemTag[] = ["hot", "chopsticks"];
      for (const item of items.filter((i) => i.level === 1)) {
        for (const tag of item.tags) expect(allowed, item.id).toContain(tag);
      }
    });

    it("레벨 1~4 에 모두 상품이 있고, 가격은 양의 정수", () => {
      for (const level of [1, 2, 3, 4]) {
        expect(items.some((i) => i.level === level), `level ${level}`).toBe(true);
      }
      for (const item of items) {
        expect(item.level).toBeGreaterThanOrEqual(1);
        expect(item.level).toBeLessThanOrEqual(4);
        expect(Number.isInteger(item.price)).toBe(true);
        expect(item.price).toBeGreaterThan(0);
      }
    });

    it("visual 색은 hex", () => {
      for (const item of items) {
        expect(item.visual.color).toMatch(HEX);
        if (item.visual.accent) expect(item.visual.accent).toMatch(HEX);
      }
    });

    it("담배는 6종 이상, 각각 선반 번호(1~99)를 갖고 번호는 유일. 담배가 아니면 번호 없음", () => {
      const tobacco = items.filter((i) => i.tags.includes("tobacco"));
      expect(tobacco.length).toBeGreaterThanOrEqual(6);
      for (const item of tobacco) {
        expect(item.code, item.id).toMatch(/^[1-9][0-9]?$/);
      }
      expect(duplicates(tobacco.map((i) => i.code ?? ""))).toEqual([]);
      expect(items.filter((i) => !i.tags.includes("tobacco") && i.code !== undefined)).toEqual([]);
    });

    it("오뎅 5종 이상, 튀김·핫스낵 5종 이상 (심야 전용 레벨 4)", () => {
      const oden = items.filter((i) => i.tags.includes("oden"));
      const fried = items.filter((i) => i.tags.includes("fried"));
      expect(oden.length).toBeGreaterThanOrEqual(5);
      expect(fried.length).toBeGreaterThanOrEqual(5);
      for (const item of [...oden, ...fried]) expect(item.level, item.id).toBe(4);
    });

    it("시즌 한정 상품은 12개 이상, 달은 1~12, 모든 달에 하나 이상", () => {
      const seasonal = items.filter((i) => i.season !== undefined);
      expect(seasonal.length).toBeGreaterThanOrEqual(12);
      for (const item of seasonal) {
        expect(Number.isInteger(item.season), item.id).toBe(true);
        expect(item.season, item.id).toBeGreaterThanOrEqual(1);
        expect(item.season, item.id).toBeLessThanOrEqual(12);
      }
      for (const month of MONTHS) {
        expect(seasonal.some((i) => i.season === month), `${month}월`).toBe(true);
      }
    });

    it("연중 상품만으로도 모든 시프트에서 손님을 만들 수 있다 (시즌 상품 제외 시 활성 태그마다 1개 이상)", () => {
      const yearRound = items.filter((i) => i.season === undefined);
      for (const slot of SHIFT_SLOTS) {
        const config = shifts[slot];
        for (const tag of config.activeTags) {
          const fits = (i: (typeof items)[number]) =>
            i.tags.includes(tag) && i.tags.every((t) => config.activeTags.includes(t));
          // 레벨 안의 연중 상품이 있거나, 그 시간대 단골의 고정 구매로만 나오는 태그(아침 다나카의 담배)
          const ok =
            yearRound.some((i) => i.level <= config.level && fits(i)) ||
            regulars.some((r) => r.slots.includes(slot) && r.purchase.some((id) => items.some((i) => i.id === id && fits(i))));
          expect(ok, `${slot}: ${tag}`).toBe(true);
        }
      }
    });
  });

  describe("취객 대사", () => {
    it("반응·당황·이탈이 모두 있고 ja 가 겹치지 않는다", () => {
      const drunk = konbini.drunkReplies;
      expect(drunk).toBeDefined();
      expect(drunk!.reply.length).toBeGreaterThanOrEqual(6);
      expect(drunk!.confused.length).toBeGreaterThanOrEqual(4);
      expect(drunk!.leave.length).toBeGreaterThanOrEqual(3);
      const all = [...drunk!.reply, ...drunk!.confused, ...drunk!.leave];
      expect(duplicates(all.map((r) => r.ja))).toEqual([]);
      for (const r of all) expect(r.ko.length).toBeGreaterThan(0);
    });
  });

  describe("접객 문구", () => {
    it("80개 이상, id 유일, ja 중복 없음", () => {
      expect(phrases.length).toBeGreaterThanOrEqual(80);
      expect(duplicates(phrases.map((p) => p.id))).toEqual([]);
      expect(duplicates(phrases.map((p) => p.ja))).toEqual([]);
    });

    it("모든 질문 종류에 정답 문구가 2개 이상(TOTAL 은 1개)이고, 첫 등장 레벨에 하나 이상 있다", () => {
      for (const kind of QUESTION_KINDS) {
        if (KIND_MIN_LEVEL[kind] === 0) continue; // 합성 선택지(TOBACCO_PICK·LISTEN)는 문구가 없다
        const correct = phrases.filter((p) => p.kind === kind);
        expect(correct.length, kind).toBeGreaterThanOrEqual(kind === "TOTAL" ? 1 : 2);
        const minLevel = Math.min(...correct.map((p) => p.level));
        expect(minLevel, `${kind} min level`).toBeLessThanOrEqual(KIND_MIN_LEVEL[kind]);
      }
      // 합성 선택지에는 콘텐츠 문구가 없다
      expect(phrases.filter((p) => p.kind === "TOBACCO_PICK" || p.kind === "LISTEN")).toEqual([]);
    });

    it("PAY 는 결제수단별 정답이 정확히 하나", () => {
      const pay = phrases.filter((p) => p.kind === "PAY");
      for (const method of PAYMENT_METHODS) {
        expect(pay.filter((p) => p.payment === method).length, method).toBe(1);
      }
      expect(pay.every((p) => p.payment !== undefined)).toBe(true);
      // payment 는 PAY 문구에만 붙는다
      expect(phrases.filter((p) => p.kind !== "PAY" && p.payment !== undefined)).toEqual([]);
    });

    it("DIRECTIONS 는 방향별 정답이 하나 이상, direction 은 DIRECTIONS 문구에만", () => {
      const dir = phrases.filter((p) => p.kind === "DIRECTIONS");
      for (const direction of DIRECTIONS) {
        expect(dir.filter((p) => p.direction === direction).length, direction).toBeGreaterThanOrEqual(1);
      }
      expect(dir.every((p) => p.direction !== undefined)).toBe(true);
      expect(phrases.filter((p) => p.kind !== "DIRECTIONS" && p.direction !== undefined)).toEqual([]);
    });

    it("TOTAL 은 {total} 템플릿 하나", () => {
      const total = phrases.filter((p) => p.kind === "TOTAL");
      expect(total.length).toBe(1);
      expect(total[0].ja).toContain("{total}");
      expect(total[0].ko).toContain("{total}");
      expect(total[0].reading).toContain("{total}");
      // 다른 문구는 {total} 을 쓰지 않는다 (엔진이 TOTAL 에서만 치환)
      expect(phrases.filter((p) => p.kind !== "TOTAL" && p.ja.includes("{total}"))).toEqual([]);
    });

    it("카테고리마다 문구가 2개 이상 (근접 오답 생성용)", () => {
      for (const category of CATEGORIES) {
        expect(phrases.filter((p) => p.category === category).length, category).toBeGreaterThanOrEqual(2);
      }
    });

    it("오답 전용 문구는 20개 이상, stage 를 가지며, 카테고리별 2개 이상", () => {
      const distractors = phrases.filter((p) => p.kind === null);
      expect(distractors.length).toBeGreaterThanOrEqual(20);
      for (const p of distractors) {
        expect(p.stage, p.id).toBeDefined();
        expect(p.payment, p.id).toBeUndefined();
        expect(p.direction, p.id).toBeUndefined();
      }
      for (const category of CATEGORIES) {
        expect(distractors.filter((p) => p.category === category).length, category).toBeGreaterThanOrEqual(2);
      }
      expect(distractors.some((p) => p.stage === "GREETING")).toBe(true);
      expect(distractors.some((p) => p.stage === "THANKS")).toBe(true);
    });

    it("근접 오답 함정이 들어 있다 (ご利用 vs お持ち, 温め vs 冷やし, お持ち vs お作り)", () => {
      const ja = new Set(phrases.filter((p) => p.kind === null).map((p) => p.ja));
      expect(ja.has("袋はお持ちですか？")).toBe(true);
      expect(ja.has("冷やしますか？")).toBe(true);
      expect(ja.has("ポイントカードをお作りしますか？")).toBe(true);
    });

    it("레벨은 1~4, 모든 문구에 reading(한자 없음)과 parts 가 있다", () => {
      for (const p of phrases) {
        expect(p.level, p.id).toBeGreaterThanOrEqual(1);
        expect(p.level, p.id).toBeLessThanOrEqual(4);
        expect(p.reading, p.id).toBeDefined();
        expect(p.reading, p.id).not.toMatch(KANJI);
        expect(p.parts, p.id).toBeDefined();
        expect(p.parts?.length, p.id).toBeGreaterThan(0);
      }
    });
  });

  describe("레귤러", () => {
    it("16명 이상, id 유일", () => {
      expect(regulars.length).toBeGreaterThanOrEqual(16);
      expect(duplicates(regulars.map((r) => r.id))).toEqual([]);
    });

    it("구매 패턴의 상품은 모두 존재한다", () => {
      const ids = new Set(items.map((i) => i.id));
      for (const r of regulars) {
        for (const itemId of r.purchase) expect(ids.has(itemId), `${r.id}: ${itemId}`).toBe(true);
      }
    });

    it("구매 패턴이 있는 단골은 오는 시간대마다 등장 가능한 상품이 하나 이상 (무작위 장바구니로 떨어지지 않는다)", () => {
      // 田中의 담배처럼 일부 상품은 그 시간대 레벨에서 걸러질 수 있지만, 전부 걸러져 패턴이 사라지면 안 된다
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const r of regulars) {
        if (r.purchase.length === 0) continue;
        for (const slot of r.slots) {
          const config = shifts[slot];
          const ok = r.purchase.some((itemId) => {
            const item = byId.get(itemId);
            return (
              item !== undefined && item.level <= config.level && item.tags.every((t) => config.activeTags.includes(t))
            );
          });
          expect(ok, `${r.id} @ ${slot}`).toBe(true);
        }
      }
    });

    it("시즌 한정 단골의 시즌 상품은 그 달에 등장한다", () => {
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const r of regulars) {
        for (const itemId of r.purchase) {
          const item = byId.get(itemId);
          if (!item || item.season === undefined) continue;
          expect(r.unlock.type, `${r.id}: ${itemId} 는 시즌 상품`).toBe("season");
          if (r.unlock.type === "season") expect(r.unlock.month, `${r.id}: ${itemId}`).toBe(item.season);
        }
      }
    });

    it("모든 firstWords 는 parts 가 있고, 한자가 있으면 reading(한자 없음)이 있다", () => {
      for (const r of regulars) {
        for (const w of r.firstWords) {
          expect(w.parts, `${r.id}: ${w.ja}`).toBeDefined();
          expect(w.parts?.length, `${r.id}: ${w.ja}`).toBeGreaterThan(0);
          if (KANJI.test(w.ja)) expect(w.reading, `${r.id}: ${w.ja}`).toBeDefined();
          if (w.reading) expect(w.reading, `${r.id}: ${w.ja}`).not.toMatch(KANJI);
        }
      }
    });

    it("대사 5줄, 호감도 1..5 각각 하나", () => {
      for (const r of regulars) {
        expect(r.lines.length, r.id).toBe(5);
        expect(r.lines.map((l) => l.affinity).sort()).toEqual([1, 2, 3, 4, 5]);
      }
    });

    it("처음 들은 말 2~3개, 시간대 1개 이상, 결제수단 유효, 색은 hex", () => {
      for (const r of regulars) {
        expect(r.firstWords.length, r.id).toBeGreaterThanOrEqual(2);
        expect(r.firstWords.length, r.id).toBeLessThanOrEqual(3);
        expect(r.slots.length, r.id).toBeGreaterThanOrEqual(1);
        for (const slot of r.slots) expect(SHIFT_SLOTS).toContain(slot);
        expect(PAYMENT_METHODS).toContain<PaymentMethod>(r.payment);
        for (const color of [r.visual.skin, r.visual.hairColor, r.visual.outfit]) expect(color, r.id).toMatch(HEX);
        if (r.visual.accent) expect(r.visual.accent, r.id).toMatch(HEX);
      }
    });

    it("해금 조건: 시프트 해금 2명 이상(저녁·심야), 승급 해금 1명 이상, 시즌 해금 4명 이상이 서로 다른 달 4개 이상(12월 포함)", () => {
      const slotUnlocks = regulars.filter((r) => r.unlock.type === "slot");
      expect(slotUnlocks.length).toBeGreaterThanOrEqual(2);
      expect(slotUnlocks.some((r) => r.unlock.type === "slot" && r.unlock.slot === "yoru")).toBe(true);
      expect(slotUnlocks.some((r) => r.unlock.type === "slot" && r.unlock.slot === "shinya")).toBe(true);
      // 시프트 해금 단골은 그 시간대에 실제로 온다
      for (const r of slotUnlocks) {
        if (r.unlock.type === "slot") expect(r.slots, r.id).toContain(r.unlock.slot);
      }
      expect(regulars.filter((r) => r.unlock.type === "rank").length).toBeGreaterThanOrEqual(1);

      const season = regulars.filter((r) => r.unlock.type === "season");
      expect(season.length).toBeGreaterThanOrEqual(4);
      const months = new Set(season.map((r) => (r.unlock.type === "season" ? r.unlock.month : 0)));
      expect(months.size).toBeGreaterThanOrEqual(4);
      expect(months.has(12)).toBe(true);
      for (const m of months) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      }
    });

    it("심야 시프트에도 오는 단골이 2명 이상", () => {
      expect(regulars.filter((r) => r.slots.includes("shinya")).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("점장", () => {
    it("모든 순간에 3줄 이상, 홈은 시간대별로 1줄 이상(심야 2줄 이상)", () => {
      for (const when of [
        "home",
        "shift_end_good",
        "shift_end_mid",
        "shift_end_bad",
        "absent",
        "exam_ready",
        "exam_pass",
        "exam_fail",
      ] as const) {
        expect(manager.filter((m) => m.when === when).length, when).toBeGreaterThanOrEqual(3);
      }
      for (const slot of SHIFT_SLOTS) {
        expect(manager.filter((m) => m.when === "home" && m.slot === slot).length, slot).toBeGreaterThanOrEqual(1);
      }
      expect(manager.filter((m) => m.when === "home" && m.slot === "shinya").length).toBeGreaterThanOrEqual(2);
    });

    it("시즌 대사는 달마다 정확히 하나, month 는 season 대사에만", () => {
      const season = manager.filter((m) => m.when === "season");
      for (const month of MONTHS) {
        expect(season.filter((m) => m.month === month).length, `${month}월`).toBe(1);
      }
      expect(manager.filter((m) => m.when !== "season" && m.month !== undefined)).toEqual([]);
      expect(manager.filter((m) => m.when !== "home" && m.slot !== undefined)).toEqual([]);
    });

    it("디자인 시안 문구를 포함한다", () => {
      expect(manager.some((m) => m.when === "home" && m.slot === "hiru" && m.ja === "昼は混むぞ。袋の質問、忘れるなよ。")).toBe(true);
      expect(manager.some((m) => m.when === "shift_end_good" && m.ja === "よくやった。明日は鈴木さんが来るぞ。")).toBe(true);
      expect(manager.some((m) => m.when === "absent" && m.ja === "昨日どうした？")).toBe(true);
    });
  });

  describe("시프트·직급", () => {
    it("4개 시간대 모두 있고 slot 이 키와 일치", () => {
      for (const slot of SHIFT_SLOTS) {
        expect(shifts[slot].slot).toBe(slot);
        for (const tag of shifts[slot].activeTags) expect(ITEM_TAGS).toContain(tag);
        expect(shifts[slot].itemsPerCustomer[0]).toBeLessThanOrEqual(shifts[slot].itemsPerCustomer[1]);
      }
    });

    it("직급은 6개, 필요 시프트 수 오름차순, 신입은 0", () => {
      expect(ranks.length).toBe(6);
      expect(ranks[0].shiftsRequired).toBe(0);
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i].shiftsRequired).toBeGreaterThan(ranks[i - 1].shiftsRequired);
      }
      expect(ranks.find((r) => r.id === "senpai")?.unlocksTags).toEqual(["alcohol", "tobacco"]);
    });
  });

  describe("손님 대사", () => {
    it("모든 질문 종류에 응답 5개 이상과 힌트가 있다", () => {
      for (const kind of QUESTION_KINDS) {
        expect(replies[kind].length, kind).toBeGreaterThanOrEqual(5);
        expect(hints[kind], kind).toBeDefined();
      }
      for (const kind of QUESTION_ORDER) expect(replies[kind].length, kind).toBeGreaterThanOrEqual(5);
    });

    it("당황 8개 이상 · 이탈 6개 이상", () => {
      expect(confusedReplies.length).toBeGreaterThanOrEqual(8);
      expect(leaveReplies.length).toBeGreaterThanOrEqual(6);
    });

    it("리스닝 요구는 모든 타깃에 5개 이상, 라벨도 모두 있다", () => {
      for (const target of LISTEN_TARGETS) {
        expect(listenRequests[target]?.length ?? 0, target).toBeGreaterThanOrEqual(5);
        expect(listenTargets[target].ja.length, target).toBeGreaterThan(0);
        expect(listenTargets[target].icon.length, target).toBeGreaterThan(0);
      }
    });

    it("돌발 이벤트 첫마디는 모든 종류에 4개 이상, 관광객용 영어가 하나 이상", () => {
      for (const kind of EVENT_KINDS) {
        expect(eventPrompts[kind].length, kind).toBeGreaterThanOrEqual(4);
        expect(eventPrompts[kind].some((r) => r.en), kind).toBe(true);
      }
    });

    it("담배 번호 요구는 5개 이상이고 모두 {n} 을 가진다", () => {
      expect(tobaccoRequests.length).toBeGreaterThanOrEqual(5);
      for (const r of tobaccoRequests) {
        expect(r.ja).toContain("{n}");
        expect(r.ko).toContain("{n}");
        if (r.en) expect(r.en).toContain("{n}");
      }
    });

    it("손님 대사 총합 300줄 이상 (응답·당황·힌트·이탈·리스닝·이벤트·담배)", () => {
      const total =
        Object.values(replies).reduce((n, list) => n + list.length, 0) +
        confusedReplies.length +
        Object.values(hints).length +
        leaveReplies.length +
        Object.values(listenRequests).reduce((n, list) => n + (list?.length ?? 0), 0) +
        Object.values(eventPrompts).reduce((n, list) => n + list.length, 0) +
        tobaccoRequests.length;
      expect(total).toBeGreaterThanOrEqual(300);
    });

    it("모든 대사는 ja·ko 가 비어 있지 않다", () => {
      const all = [
        ...Object.values(replies).flat(),
        ...confusedReplies,
        ...Object.values(hints),
        ...leaveReplies,
        ...Object.values(listenRequests).flat(),
        ...Object.values(eventPrompts).flat(),
        ...tobaccoRequests,
        ...regulars.flatMap((r) => r.firstWords),
      ];
      for (const r of all) {
        expect(r.ja.length).toBeGreaterThan(0);
        expect(r.ko.length).toBeGreaterThan(0);
      }
    });
  });

  describe("시즌", () => {
    it("12개월 각 하나, month 유일", () => {
      expect(seasons.length).toBe(12);
      expect(duplicates(seasons.map((s) => String(s.month)))).toEqual([]);
      for (const month of MONTHS) {
        expect(seasons.some((s) => s.month === month), `${month}월`).toBe(true);
      }
    });

    it("이름·포스터가 비어 있지 않다", () => {
      for (const s of seasons) {
        expect(s.nameJa.length, `${s.month}월`).toBeGreaterThan(0);
        expect(s.nameKo.length, `${s.month}월`).toBeGreaterThan(0);
        expect(s.posterJa.length, `${s.month}월`).toBeGreaterThan(0);
      }
    });

    it("규칙 변경이 있는 달은 4개 이상이고, 규칙과 공지(ja·ko)는 항상 함께 있다", () => {
      const ruled = seasons.filter((s) => s.rule !== undefined);
      expect(ruled.length).toBeGreaterThanOrEqual(4);
      for (const s of seasons) {
        const hasNotice = s.noticeJa !== undefined && s.noticeKo !== undefined;
        expect(hasNotice, `${s.month}월`).toBe(s.rule !== undefined);
        if (s.rule) {
          expect(["bagSize", "pointCardAlways", "receiptAsk"]).toContain(s.rule.kind);
          expect(s.noticeJa?.length).toBeGreaterThan(0);
          expect(s.noticeKo?.length).toBeGreaterThan(0);
        }
      }
      // 세 종류의 규칙이 모두 한 번 이상 쓰인다
      const kinds = new Set(ruled.map((s) => s.rule?.kind));
      expect(kinds.size).toBe(3);
    });

    it("시즌 규칙 질문(BAG_SIZE·RECEIPT_ASK)은 레벨 1 정답 문구가 있다", () => {
      for (const kind of ["BAG_SIZE", "RECEIPT_ASK"] as const) {
        expect(phrases.some((p) => p.kind === kind && p.level === 1), kind).toBe(true);
      }
    });
  });

  describe("영어 자막 완비", () => {
    /** 비어 있지 않은 영어 문자열인지 */
    const filled = (v: string | undefined) => typeof v === "string" && v.trim().length > 0;
    /** 자막 톤 위반 — 학습 앱 단어·이모지·한글·가나 금지 */
    const BANNED = /\b(study|studying|lesson|quiz|correct answer)\b/i;
    const EMOJI = /\p{Extended_Pictographic}/u;
    const CJK = /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/;

    /** 모든 영어 자막을 [위치, 문자열] 로 모은다 */
    function allEnglish(): [string, string | undefined][] {
      const out: [string, string | undefined][] = [];
      out.push(["workplace.nameEn", konbini.nameEn]);
      for (const p of phrases) out.push([`phrase ${p.id}`, p.en]);
      for (const i of konbini.items) out.push([`item ${i.id}`, i.en]);
      for (const r of konbini.regulars) {
        out.push([`regular ${r.id}.nameEn`, r.nameEn]);
        out.push([`regular ${r.id}.ticEn`, r.ticEn]);
        out.push([`regular ${r.id}.roleEn`, r.roleEn]);
        if (r.unlock.type !== "open") out.push([`regular ${r.id}.unlock.labelEn`, r.unlock.labelEn]);
        r.lines.forEach((l, n) => out.push([`regular ${r.id}.lines[${n}]`, l.en]));
        r.firstWords.forEach((w, n) => out.push([`regular ${r.id}.firstWords[${n}]`, w.en]));
      }
      konbini.manager.forEach((m, n) => out.push([`manager[${n}]`, m.en]));
      for (const r of konbini.ranks) out.push([`rank ${r.id}`, r.en]);
      for (const s of SHIFT_SLOTS) {
        out.push([`shift ${s}.nameEn`, konbini.shifts[s].nameEn]);
        out.push([`shift ${s}.descriptionEn`, konbini.shifts[s].descriptionEn]);
      }
      for (const s of konbini.seasons) {
        out.push([`season ${s.month}.nameEn`, s.nameEn]);
        if (s.noticeJa !== undefined) out.push([`season ${s.month}.noticeEn`, s.noticeEn]);
      }
      for (const t of LISTEN_TARGETS) out.push([`listenTarget ${t}`, konbini.listenTargets[t].en]);
      for (const [label, list] of replyGroups()) list.forEach((r, n) => out.push([`${label}[${n}]`, r.en]));
      return out;
    }

    /** 손님 대사 묶음 — 같은 묶음 안에서 en 중복을 검사하는 단위 */
    function replyGroups(): [string, { ja: string; en?: string }[]][] {
      const groups: [string, { ja: string; en?: string }[]][] = [];
      for (const k of QUESTION_KINDS) groups.push([`replies.${k}`, konbini.replies[k] ?? []]);
      groups.push(["confusedReplies", konbini.confusedReplies]);
      groups.push(["leaveReplies", konbini.leaveReplies]);
      groups.push(["hints", Object.values(konbini.hints).filter((h) => h !== undefined)]);
      for (const t of LISTEN_TARGETS) groups.push([`listenRequests.${t}`, konbini.listenRequests[t] ?? []]);
      for (const e of EVENT_KINDS) groups.push([`eventPrompts.${e}`, konbini.eventPrompts[e]]);
      groups.push(["tobaccoRequests", konbini.tobaccoRequests]);
      const drunk = konbini.drunkReplies;
      if (drunk) {
        groups.push(["drunk.reply", drunk.reply]);
        groups.push(["drunk.confused", drunk.confused]);
        groups.push(["drunk.leave", drunk.leave]);
      }
      return groups;
    }

    it("모든 영어 자막 필드가 채워져 있다", () => {
      const missing = allEnglish()
        .filter(([, v]) => !filled(v))
        .map(([where]) => where);
      expect(missing).toEqual([]);
    });

    it("영어 자막에 학습 앱 단어·이모지·한글·가나가 없다", () => {
      // 마이크·하나의 대사는 일본어·한국어 로마자 표기만 허용(원문 문자는 금지)
      const bad = allEnglish()
        .filter(([, v]) => filled(v) && (BANNED.test(v!) || EMOJI.test(v!) || CJK.test(v!)))
        .map(([where, v]) => `${where}: ${v}`);
      expect(bad).toEqual([]);
    });

    it("TOTAL 영어 문구는 {total} 을 정확히 한 번 갖고 단위를 중복으로 붙이지 않는다", () => {
      for (const p of phrases.filter((x) => x.kind === "TOTAL")) {
        const en = p.en ?? "";
        expect(en.split("{total}").length - 1, p.id).toBe(1);
        // 엔진이 " yen" 을 붙이므로, yen 은 쓰지 않거나 "{total} yen" 형태만 허용
        const withoutPlaceholderYen = en.replace("{total} yen", "{total}");
        expect(/\byen\b|¥|円/i.test(withoutPlaceholderYen), p.id).toBe(false);
      }
    });

    it("담배 번호 요구 영어 템플릿은 {n} 을 갖는다", () => {
      for (const r of konbini.tobaccoRequests) expect(r.en, r.ja).toContain("{n}");
    });

    it("문구·상품·점장 대사의 영어는 서로 겹치지 않는다", () => {
      const dupes = (list: (string | undefined)[]) =>
        list.filter((v, i) => v !== undefined && list.indexOf(v) !== i);
      expect(dupes(phrases.map((p) => p.en))).toEqual([]);
      expect(dupes(konbini.items.map((i) => i.en))).toEqual([]);
      expect(dupes(konbini.manager.map((m) => m.en))).toEqual([]);
      expect(dupes(konbini.regulars.map((r) => r.nameEn))).toEqual([]);
      expect(dupes(konbini.ranks.map((r) => r.en))).toEqual([]);
      expect(dupes(konbini.seasons.map((s) => s.nameEn))).toEqual([]);
      expect(dupes(SHIFT_SLOTS.map((s) => konbini.shifts[s].nameEn))).toEqual([]);
    });

    it("같은 묶음 안의 손님 대사는 일본어가 다르면 영어도 다르다", () => {
      const bad: string[] = [];
      const check = (label: string, list: { ja: string; en?: string }[]) => {
        const seen = new Map<string, string>();
        for (const r of list) {
          if (r.en === undefined) continue;
          const prev = seen.get(r.en);
          if (prev !== undefined && prev !== r.ja) bad.push(`${label}: "${r.en}" (${prev} / ${r.ja})`);
          seen.set(r.en, r.ja);
        }
      };
      for (const [label, list] of replyGroups()) check(label, list);
      for (const r of konbini.regulars) {
        check(`regular ${r.id}.lines`, r.lines);
        check(`regular ${r.id}.firstWords`, r.firstWords);
      }
      expect(bad).toEqual([]);
    });
  });
});
