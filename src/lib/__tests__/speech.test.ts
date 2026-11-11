// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isSpeechRecognitionSupported,
  listenOnce,
  matchSpoken,
  MATCH_THRESHOLD,
  normalizeJa,
  similarityJa,
  type SpeechRecognitionLike,
} from "../speech";

/* ───────────────────────── 정규화 · 매칭 ───────────────────────── */

describe("normalizeJa", () => {
  it("공백·구두점·장음을 지우고 가타카나를 히라가나로 바꾼다", () => {
    expect(normalizeJa("温めますか？")).toBe("温めますか");
    expect(normalizeJa("レジ袋は ご利用ですか ？")).toBe("れじ袋はご利用ですか");
    expect(normalizeJa("ストロー")).toBe("すとろ");
    expect(normalizeJa("合計で　６６０円です")).toBe("合計で660円です");
  });
});

describe("similarityJa", () => {
  it("같은 문장은 1, 전혀 다른 문장은 0 에 가깝다", () => {
    expect(similarityJa("温めますか？", "温めますか")).toBe(1);
    expect(similarityJa("温めますか？", "ストローはお使いですか？")).toBeLessThan(0.2);
  });
  it("핵심 형태소만 말해도 높은 점수", () => {
    expect(similarityJa("温めますか", "温めますか？")).toBeGreaterThan(MATCH_THRESHOLD);
    expect(similarityJa("袋ご利用ですか", "レジ袋はご利用ですか？")).toBeGreaterThan(MATCH_THRESHOLD);
  });
});

describe("matchSpoken", () => {
  const options = [
    { phraseId: "warm", ja: "温めますか？" },
    { phraseId: "bag", ja: "レジ袋はご利用ですか？" },
    { phraseId: "chop", ja: "お箸はお付けしますか？" },
    { phraseId: "straw", ja: "ストローはお使いですか？" },
  ];

  it("정확히 말하면 그 선택지", () => {
    expect(matchSpoken(["温めますか"], options)?.phraseId).toBe("warm");
    expect(matchSpoken(["お箸はお付けしますか"], options)?.phraseId).toBe("chop");
  });
  it("조금 틀리거나 줄여 말해도 통과(너그러운 매칭)", () => {
    expect(matchSpoken(["レジ袋ご利用ですか"], options)?.phraseId).toBe("bag");
    expect(matchSpoken(["ストロー使いますか"], options)?.phraseId).toBe("straw");
  });
  it("여러 후보 중 하나라도 맞으면 통과", () => {
    expect(matchSpoken(["こんにちは", "温めますか"], options)?.phraseId).toBe("warm");
  });
  it("아무것도 안 비슷하면 null, 빈 입력도 null", () => {
    expect(matchSpoken(["いらっしゃいませ"], options)).toBeNull();
    expect(matchSpoken([], options)).toBeNull();
    expect(matchSpoken(["温めますか"], [])).toBeNull();
  });
  it("두 선택지와 비슷하게 겹치면(애매) null", () => {
    const twins = [
      { phraseId: "a", ja: "ポイントカードはお持ちですか？" },
      { phraseId: "b", ja: "ポイントカードをお作りしますか？" },
    ];
    expect(matchSpoken(["ポイントカード"], twins)).toBeNull();
    expect(matchSpoken(["ポイントカードはお持ちですか"], twins)?.phraseId).toBe("a");
  });
  it("금액 문구는 숫자가 맞는 쪽", () => {
    const totals = [
      { phraseId: "t660", ja: "合計で 660円です" },
      { phraseId: "t760", ja: "合計で 760円です" },
    ];
    expect(matchSpoken(["合計で660円です"], totals)?.phraseId).toBe("t660");
  });
});

/* ───────────────────────── 인식 세션 (가짜 인식기) ───────────────────────── */

type Handler<T> = ((e: T) => void) | null;
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: Handler<Parameters<NonNullable<SpeechRecognitionLike["onresult"]>>[0]> = null;
  onerror: Handler<{ error: string }> = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  aborted = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
  /** 테스트용: 결과 이벤트 흉내 */
  emit(transcripts: string[], isFinal: boolean) {
    const result = Object.assign(
      transcripts.map((t) => ({ transcript: t, confidence: 0.9 })),
      { isFinal, length: transcripts.length },
    );
    this.onresult?.({ resultIndex: 0, results: Object.assign([result], { length: 1 }) });
  }
}

function installFake() {
  FakeRecognition.instances = [];
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
}
function uninstallFake() {
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
}

afterEach(() => {
  uninstallFake();
  vi.useRealTimers();
});

describe("listenOnce", () => {
  it("미지원 브라우저면 즉시 unsupported", async () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    const session = listenOnce();
    await expect(session.result).resolves.toEqual({ transcripts: [], error: "unsupported" });
  });

  it("ja-JP 로 시작하고 최종 결과가 오면 후보들을 돌려준다(중간 결과는 onInterim)", async () => {
    installFake();
    expect(isSpeechRecognitionSupported()).toBe(true);
    const onInterim = vi.fn();
    const session = listenOnce({ onInterim });
    const rec = FakeRecognition.instances[0];
    expect(rec.lang).toBe("ja-JP");
    expect(rec.started).toBe(true);
    rec.emit(["温め"], false);
    expect(onInterim).toHaveBeenCalledWith("温め");
    rec.emit(["温めますか", "暖めますか"], true);
    await expect(session.result).resolves.toEqual({ transcripts: ["温めますか", "暖めますか"], error: null });
    expect(rec.stopped).toBe(true);
  });

  it("최종 결과 없이 끝나면 마지막 중간 결과를 후보로 쓴다", async () => {
    installFake();
    const session = listenOnce();
    const rec = FakeRecognition.instances[0];
    rec.emit(["お箸"], false);
    rec.onend?.();
    await expect(session.result).resolves.toEqual({ transcripts: ["お箸"], error: null });
  });

  it("권한 거부는 not-allowed 로, 아무 말 없으면 no-speech 로 끝난다(reject 하지 않음)", async () => {
    installFake();
    const a = listenOnce();
    FakeRecognition.instances[0].onerror?.({ error: "not-allowed" });
    await expect(a.result).resolves.toEqual({ transcripts: [], error: "not-allowed" });
    const b = listenOnce();
    FakeRecognition.instances[1].onend?.();
    await expect(b.result).resolves.toEqual({ transcripts: [], error: "no-speech" });
  });

  it("cancel 은 abort 하고 aborted 로 끝낸다 · timeout 도 끝낸다", async () => {
    installFake();
    vi.useFakeTimers();
    const a = listenOnce({ timeoutMs: 1000 });
    a.cancel();
    expect(FakeRecognition.instances[0].aborted).toBe(true);
    await expect(a.result).resolves.toEqual({ transcripts: [], error: "aborted" });
    const b = listenOnce({ timeoutMs: 1000 });
    vi.advanceTimersByTime(1001);
    await expect(b.result).resolves.toEqual({ transcripts: [], error: "timeout" });
    expect(FakeRecognition.instances[1].stopped).toBe(true);
  });
});
