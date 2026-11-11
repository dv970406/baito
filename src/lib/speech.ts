/**
 * 말하기 모드 — Web Speech API(ja-JP) 음성 인식과 너그러운 문구 매칭.
 *
 * 설계 원칙(기획서): 발음 시험이 아니라 발화 습관을 만든다.
 * - 핵심 형태소만 맞으면 통과시킨다(바이그램 유사도).
 * - 인식 실패는 벌점이 아니다. 버튼으로 다시 고르면 된다.
 * - 미지원 브라우저에서는 버튼 자체를 숨긴다.
 *
 * 매칭 함수는 순수 함수라 테스트 가능하고, 인식기 접근은 모두 try/catch 로 감싼다.
 */

/* ───────────────────────── 브라우저 API 최소 타입 ───────────────────────── */

interface RecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface RecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternativeLike;
}
interface RecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResultLike };
}
interface RecognitionErrorEventLike {
  error: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 이 브라우저에서 음성 인식을 쓸 수 있는가 (SSR 에서는 false) */
export function isSpeechRecognitionSupported(): boolean {
  try {
    return getRecognitionCtor() !== null;
  } catch {
    return false;
  }
}

/* ───────────────────────── 정규화 · 매칭 (순수) ───────────────────────── */

/**
 * 일본어 발화 비교용 정규화:
 * NFKC → 가타카나를 히라가나로 → 공백·구두점·기호 제거 → 장음(ー) 제거.
 * 한자는 그대로 둔다(인식기도 보통 한자로 돌려준다).
 */
export function normalizeJa(text: string): string {
  const nfkc = text.normalize("NFKC");
  let out = "";
  for (const ch of nfkc) {
    const code = ch.codePointAt(0) ?? 0;
    // 가타카나(ァ..ヶ) → 히라가나
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
      continue;
    }
    if (/[\s\p{P}\p{S}ー〜～]/u.test(ch)) continue;
    out += ch;
  }
  return out;
}

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  if (s.length < 2) {
    if (s.length === 1) map.set(s, 1);
    return map;
  }
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

/** 바이그램 Dice 유사도 0..1 */
export function similarityJa(a: string, b: string): number {
  const na = normalizeJa(a);
  const nb = normalizeJa(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let overlap = 0;
  for (const [g, c] of ga) overlap += Math.min(c, gb.get(g) ?? 0);
  const total = [...ga.values()].reduce((x, y) => x + y, 0) + [...gb.values()].reduce((x, y) => x + y, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export interface SpokenCandidate {
  phraseId: string;
  ja: string;
}

export interface SpokenMatch {
  phraseId: string;
  score: number;
}

/** 이 점수 이상이면 "말했다"고 본다 */
export const MATCH_THRESHOLD = 0.45;
/** 1·2등이 이보다 가까우면 애매한 것으로 보고 넘기지 않는다 (단, 1등이 충분히 높으면 통과) */
export const MATCH_MARGIN = 0.12;
const CLEAR_WIN = 0.7;

/**
 * 인식 결과(여러 후보 가능)를 선택지와 비교해 가장 비슷한 것을 고른다.
 * 핵심 형태소만 맞아도 통과하도록 임계값을 낮게 두되, 두 선택지와 비슷하게 겹치면 null(애매).
 */
export function matchSpoken(transcripts: string[], candidates: SpokenCandidate[]): SpokenMatch | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map((c) => ({
    phraseId: c.phraseId,
    score: Math.max(0, ...transcripts.map((t) => similarityJa(t, c.ja))),
  }));
  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < MATCH_THRESHOLD) return null;
  if (second && best.score < CLEAR_WIN && best.score - second.score < MATCH_MARGIN) return null;
  return best;
}

/* ───────────────────────── 인식 세션 ───────────────────────── */

export interface ListenOptions {
  /** 중간 결과 콜백(화면에 "듣는 중…" 텍스트) */
  onInterim?: (text: string) => void;
  /** 이 시간 안에 결과가 없으면 중단(ms) */
  timeoutMs?: number;
  lang?: string;
}

export interface ListenResult {
  /** 최종 후보들(신뢰도 순). 아무것도 못 들었으면 빈 배열 */
  transcripts: string[];
  /** 'no-speech' | 'not-allowed' | 'aborted' | 'timeout' | 기타 */
  error: string | null;
}

export interface ListenSession {
  result: Promise<ListenResult>;
  /** 사용자가 취소(결과는 error: 'aborted') */
  cancel: () => void;
}

/**
 * 한 번 듣고 끝낸다. 결과가 없거나 권한이 없어도 reject 하지 않고 error 필드로 알린다.
 * 미지원 브라우저면 즉시 { transcripts: [], error: 'unsupported' }.
 */
export function listenOnce(opts: ListenOptions = {}): ListenSession {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return { result: Promise.resolve({ transcripts: [], error: "unsupported" }), cancel: () => undefined };
  }
  let recognition: SpeechRecognitionLike;
  try {
    recognition = new Ctor();
  } catch {
    return { result: Promise.resolve({ transcripts: [], error: "unsupported" }), cancel: () => undefined };
  }
  recognition.lang = opts.lang ?? "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  let settled = false;
  let finals: string[] = [];
  let lastInterim = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveResult: (r: ListenResult) => void = () => undefined;
  const result = new Promise<ListenResult>((resolve) => {
    resolveResult = resolve;
  });

  const finish = (error: string | null) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    // 최종 결과가 없으면 마지막 중간 결과라도 후보로 쓴다(짧은 발화는 final 없이 끝나기도 함)
    const transcripts = error === "aborted" ? [] : finals.length > 0 ? finals : lastInterim ? [lastInterim] : [];
    resolveResult({ transcripts, error: transcripts.length > 0 ? null : (error ?? "no-speech") });
  };
  const stopQuietly = () => {
    try {
      recognition.stop();
    } catch {
      /* noop */
    }
  };

  recognition.onresult = (event) => {
    const collected: string[] = [];
    let interim = "";
    for (let i = 0; i < event.results.length; i += 1) {
      const res = event.results[i];
      if (!res) continue;
      if (res.isFinal) {
        for (let j = 0; j < res.length; j += 1) {
          const alt = res[j];
          if (alt?.transcript) collected.push(alt.transcript);
        }
      } else {
        interim += res[0]?.transcript ?? "";
      }
    }
    if (interim) {
      lastInterim = interim;
      opts.onInterim?.(interim);
    }
    if (collected.length > 0) {
      finals = collected;
      stopQuietly();
      finish(null);
    }
  };
  recognition.onerror = (event) => finish(event.error || "error");
  recognition.onend = () => finish(null);

  if (opts.timeoutMs && opts.timeoutMs > 0) {
    timer = setTimeout(() => {
      stopQuietly();
      finish("timeout");
    }, opts.timeoutMs);
  }

  try {
    recognition.start();
  } catch {
    finish("error");
  }

  const cancel = () => {
    try {
      recognition.abort();
    } catch {
      /* noop */
    }
    finish("aborted");
  };

  return { result, cancel };
}
