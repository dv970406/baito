/**
 * 정답 문구 선택과 오답(디스트랙터) 생성.
 * 오답은 랜덤이 아니라 근접(같은 카테고리) · 타이밍(다른 단계) · 조합(장바구니에 없는 태그) 셋에서 하나씩 뽑는다.
 * 이 구성이 "읽으면 알겠는데 순간적으로 헷갈리는" 긴장을 만든다.
 */
import { QUESTION_TAG } from "./types";
import type {
  AnswerOption,
  CustomerSpec,
  ItemTag,
  Phrase,
  QuestionKind,
  QuestionStep,
  WorkplaceContent,
} from "./types";
import type { Rng } from "./rng";

/* ───────────────────────── 정답 문구 ───────────────────────── */

/**
 * 이 질문의 정답 문구 후보 중 레벨에 맞는 첫 번째를 돌려준다. 없으면 undefined.
 * PAY 는 손님의 결제 수단과 일치하는 문구만 정답이다.
 */
export function findCorrectPhrase(
  kind: QuestionKind,
  customer: CustomerSpec,
  content: WorkplaceContent,
  level: number,
): Phrase | undefined {
  return content.phrases.find((phrase) => isCorrectFor(phrase, kind, customer) && phrase.level <= level);
}

/** 이 질문의 정답 문구. 콘텐츠에 없으면 예외 — shift.ts 는 findCorrectPhrase 로 먼저 큐를 걸러낸다 */
export function correctPhraseFor(
  kind: QuestionKind,
  customer: CustomerSpec,
  content: WorkplaceContent,
  level: number,
): Phrase {
  const found = findCorrectPhrase(kind, customer, content, level);
  if (!found) {
    throw new Error(`correctPhraseFor: '${kind}' 의 레벨 ${level} 정답 문구가 콘텐츠에 없다`);
  }
  return found;
}

/** 이 문구가 (kind, 손님) 조합의 정답인가 — PAY 는 결제 수단까지 맞아야 한다 */
function isCorrectFor(phrase: Phrase, kind: QuestionKind, customer: CustomerSpec): boolean {
  if (phrase.kind !== kind) return false;
  if (kind === "PAY") return phrase.payment === customer.payment;
  return true;
}

/* ───────────────────────── 렌더링 ───────────────────────── */

/** 1280 → "1,280" (천 단위 구분) */
export function formatYen(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * {total} 플레이스홀더 치환. 템플릿이 이미 통화 단위(円/엔)를 플레이스홀더 뒤에 가지고 있으면 숫자만,
 * 아니면 단위를 붙여 넣는다 — 콘텐츠가 어느 쪽 표기를 택해도 "1,280円" 한 번만 나온다.
 */
function fillTotal(template: string, total: number, unit: string): string {
  const num = formatYen(total);
  return template.replace(/\{total\}(円|엔)?/g, (_match, hasUnit?: string) =>
    hasUnit ? `${num}${hasUnit}` : `${num}${unit}`,
  );
}

/** TOTAL 문구의 {total} 치환 등 — 화면에 보일 최종 텍스트 */
export function renderPhrase(phrase: Phrase, customer: CustomerSpec): { ja: string; ko: string } {
  return {
    ja: fillTotal(phrase.ja, customer.total, "円"),
    ko: fillTotal(phrase.ko, customer.total, "엔"),
  };
}

/* ───────────────────────── 오답 생성 ───────────────────────── */

export interface OptionContext {
  content: WorkplaceContent;
  customer: CustomerSpec;
  /** 이 손님의 질문 큐(종류만). 타이밍 오답 후보를 고르는 데 쓴다 */
  queue: QuestionKind[];
  level: number;
  rng: Rng;
}

/** 선택지 개수 */
export const OPTION_COUNT = 4;

/** 문구의 흐름상 위치. 정답 문구는 kind, 오답 전용은 stage */
function positionOf(phrase: Phrase): QuestionKind | "GREETING" | "THANKS" | null {
  return phrase.stage ?? phrase.kind;
}

/** 문구가 발생시키는 태그 (kind 또는 stage 기준). 태그 규칙이 아닌 질문(BAG/TOTAL/PAY/POINT_CARD)은 undefined */
function tagOfPhrase(phrase: Phrase): ItemTag | undefined {
  const pos = positionOf(phrase);
  if (pos === null || pos === "GREETING" || pos === "THANKS") return undefined;
  return QUESTION_TAG[pos];
}

/**
 * 틀린 합계 금액 후보: 자릿수 뒤바꿈, ±100, ±10 … 순으로 중복·0 이하·정답을 제외하고 3개.
 */
export function wrongTotals(total: number): number[] {
  const candidates = [
    swapDigits(total),
    total + 100,
    total - 100,
    total + 10,
    total - 10,
    total + 1000,
    total + 200,
    total + 50,
    total + 1,
  ];
  const out: number[] = [];
  for (const c of candidates) {
    if (c <= 0 || c === total || out.includes(c)) continue;
    out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

/** 인접한 서로 다른 두 자리를 바꾼 금액 (예: 1280 → 1820). 바꿀 자리가 없으면 원래 값 */
function swapDigits(total: number): number {
  const digits = String(total).split("");
  for (let i = 0; i < digits.length - 1; i++) {
    if (digits[i] !== digits[i + 1]) {
      const swapped = digits.slice();
      swapped[i] = digits[i + 1];
      swapped[i + 1] = digits[i];
      return Number.parseInt(swapped.join(""), 10);
    }
  }
  return total;
}

/**
 * 4지선다 = 정답 1 + 근접 오답 1 + 타이밍 오답 1 + 조합 오답 1, 섞어서 반환.
 * - 근접: 같은 category 의 다른 문구 (PAY 는 다른 결제 수단 문구 3개가 그대로 오답)
 * - 타이밍: 흐름상 위치가 지금 단계와 다른 문구 — 이 손님 큐의 다른 질문이나 인사(GREETING/THANKS) 우선
 * - 조합: 지금 장바구니 태그 집합에 없는 태그의 문구
 * - TOTAL: 틀린 금액 3개를 합성 (id `total.wrong.<n>`)
 * 어느 종류가 비면 레벨에 맞는 다른 문구로 채운다. 같은 kind 의 다른 변형(= 또 다른 정답)은 절대 오답으로 쓰지 않는다.
 * ja 텍스트는 서로 다르다. 콘텐츠가 너무 적어 4개를 못 채우면 그만큼만 돌려준다.
 */
export function buildOptions(step: QuestionStep, ctx: OptionContext): AnswerOption[] {
  const { content, customer, level, rng } = ctx;
  const correct =
    content.phrases.find((phrase) => phrase.id === step.correctPhraseId) ??
    correctPhraseFor(step.kind, customer, content, level);
  const correctRendered = renderPhrase(correct, customer);

  const options: AnswerOption[] = [
    { phraseId: correct.id, ...correctRendered, isCorrect: true },
  ];
  const usedIds = new Set<string>([correct.id]);
  const usedJa = new Set<string>([correctRendered.ja]);

  const add = (phrase: Phrase, override?: { phraseId: string; ja: string; ko: string }): void => {
    const rendered = override ?? { phraseId: phrase.id, ...renderPhrase(phrase, customer) };
    if (usedIds.has(rendered.phraseId) || usedJa.has(rendered.ja)) return;
    usedIds.add(rendered.phraseId);
    usedJa.add(rendered.ja);
    options.push({ ...rendered, isCorrect: false });
  };

  if (step.kind === "TOTAL") {
    wrongTotals(customer.total).forEach((wrong, i) => {
      const fake: CustomerSpec = { ...customer, total: wrong };
      const rendered = renderPhrase(correct, fake);
      add(correct, { phraseId: `total.wrong.${i + 1}`, ...rendered });
    });
    return rng.shuffle(options);
  }

  /** 오답으로 쓸 수 있는 전체 후보: 레벨 적합, 정답이 아니며, 같은 질문의 다른 변형도 아님 */
  const pool = content.phrases.filter(
    (phrase) =>
      phrase.level <= level &&
      phrase.id !== correct.id &&
      !isAlternativeCorrect(phrase, step, customer),
  );
  const available = (): Phrase[] =>
    pool.filter((phrase) => !usedIds.has(phrase.id) && !usedJa.has(renderPhrase(phrase, customer).ja));

  const pickFrom = (candidates: Phrase[]): void => {
    if (candidates.length === 0) return;
    add(rng.pick(candidates));
  };

  if (step.kind === "PAY") {
    // 다른 결제 수단 3개 — 결제 수단별로 하나씩
    const otherPayments = available().filter((phrase) => phrase.kind === "PAY");
    const byPayment = new Map<string, Phrase[]>();
    for (const phrase of otherPayments) {
      const key = phrase.payment ?? "";
      byPayment.set(key, [...(byPayment.get(key) ?? []), phrase]);
    }
    for (const variants of byPayment.values()) {
      if (options.length >= OPTION_COUNT) break;
      pickFrom(variants);
    }
  } else {
    // 근접 오답
    pickFrom(available().filter((phrase) => phrase.category === correct.category));
  }

  // 타이밍 오답: 이 손님 흐름의 다른 질문 또는 인사 우선, 없으면 위치가 다른 아무 문구
  if (options.length < OPTION_COUNT) {
    const timing = available().filter((phrase) => {
      const pos = positionOf(phrase);
      return pos !== null && pos !== step.kind;
    });
    const preferred = timing.filter((phrase) => {
      const pos = positionOf(phrase);
      return pos === "GREETING" || pos === "THANKS" || (pos !== null && ctx.queue.includes(pos));
    });
    pickFrom(preferred.length > 0 ? preferred : timing);
  }

  // 조합 오답: 장바구니에 없는 태그의 문구
  if (options.length < OPTION_COUNT) {
    const combo = available().filter((phrase) => {
      const tag = tagOfPhrase(phrase);
      return tag !== undefined && !customer.tagSet.includes(tag);
    });
    pickFrom(combo);
  }

  // 부족분은 레벨 적합 문구로 채운다
  while (options.length < OPTION_COUNT) {
    const rest = available();
    if (rest.length === 0) break;
    pickFrom(rest);
  }

  return rng.shuffle(options);
}

/** 같은 질문의 또 다른 정답 변형인가 (PAY 는 같은 결제 수단일 때만) */
function isAlternativeCorrect(phrase: Phrase, step: QuestionStep, customer: CustomerSpec): boolean {
  if (phrase.kind !== step.kind) return false;
  if (step.kind === "PAY") return phrase.payment === customer.payment;
  return true;
}
