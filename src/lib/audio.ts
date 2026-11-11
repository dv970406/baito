/**
 * 클라이언트 전용 오디오 헬퍼. SSR 안전 — 모든 함수는 window 가 없으면 아무 일도 하지 않는다.
 * - speakJa: Web Speech API 로 일본어 읽기
 * - playSfx: AudioContext 로 짧은 합성 효과음
 * - setAudioEnabled / isAudioEnabled: localStorage(`baito.audio`) 에 on/off 저장
 * - unlockAudio: 첫 사용자 제스처에서 호출해 AudioContext 를 깨운다
 * 어떤 경우에도 throw 하지 않는다.
 */

export type SfxKind = "perfect" | "good" | "late" | "wrong" | "chime" | "scan" | "leave";
export type SpeakVoice = "clerk" | "customer";

export interface SpeakOptions {
  /** 말하기 속도 (기본 1.0) */
  rate?: number;
  /** 음높이 (기본: clerk 1.1 / customer 0.9) */
  pitch?: number;
  /** 화자 프리셋 */
  voice?: SpeakVoice;
}

const STORAGE_KEY = "baito.audio";

const isBrowser = (): boolean => typeof window !== "undefined";

/* ───────────── on/off ───────────── */

let enabledCache: boolean | null = null;

export function isAudioEnabled(): boolean {
  if (!isBrowser()) return true;
  if (enabledCache !== null) return enabledCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    enabledCache = raw === null ? true : raw !== "0";
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export function setAudioEnabled(enabled: boolean): void {
  enabledCache = enabled;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* 저장 불가(프라이빗 모드 등) — 메모리 캐시만 유지 */
  }
  if (!enabled) {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
  }
}

/* ───────────── AudioContext ───────────── */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | null {
  if (!isBrowser()) return null;
  const w = window as Window & { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** 첫 터치/클릭에서 호출. 잠긴(suspended) AudioContext 를 깨우고 TTS 보이스 목록을 미리 불러온다. */
export function unlockAudio(): void {
  if (!isBrowser()) return;
  const c = getContext();
  if (c && c.state === "suspended") {
    c.resume().catch(() => undefined);
  }
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    /* noop */
  }
}

/* ───────────── 효과음 ───────────── */

interface Tone {
  /** 시작 주파수(Hz) */
  freq: number;
  /** 끝 주파수(Hz). 생략하면 freq 유지 */
  to?: number;
  /** 길이(ms) */
  ms: number;
  /** 시작 지연(ms) */
  at?: number;
  type?: OscillatorType;
  gain?: number;
}

const SFX: Record<SfxKind, Tone[]> = {
  perfect: [{ freq: 880, to: 1320, ms: 120, type: "triangle", gain: 0.25 }],
  good: [{ freq: 660, to: 880, ms: 100, type: "triangle", gain: 0.2 }],
  late: [{ freq: 440, ms: 110, type: "sine", gain: 0.18 }],
  wrong: [{ freq: 220, ms: 150, type: "square", gain: 0.12 }],
  // 편의점 입점 차임: 두 음
  chime: [
    { freq: 1046.5, ms: 180, type: "sine", gain: 0.2 },
    { freq: 1318.5, ms: 260, at: 170, type: "sine", gain: 0.2 },
  ],
  scan: [{ freq: 1760, ms: 60, type: "square", gain: 0.08 }],
  leave: [{ freq: 520, to: 320, ms: 220, type: "sine", gain: 0.16 }],
};

export function playSfx(kind: SfxKind): void {
  if (!isBrowser() || !isAudioEnabled()) return;
  const c = getContext();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => undefined);
    const now = c.currentTime;
    for (const tone of SFX[kind]) {
      const start = now + (tone.at ?? 0) / 1000;
      const end = start + tone.ms / 1000;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = tone.type ?? "sine";
      osc.frequency.setValueAtTime(tone.freq, start);
      if (tone.to !== undefined) osc.frequency.linearRampToValueAtTime(tone.to, end);
      const peak = tone.gain ?? 0.2;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    /* 오디오 실패는 게임을 막지 않는다 */
  }
}

/* ───────────── TTS ───────────── */

let jaVoice: SpeechSynthesisVoice | null | undefined;

function pickJaVoice(): SpeechSynthesisVoice | null {
  if (jaVoice !== undefined) return jaVoice;
  try {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    const ja = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("ja"));
    // 로컬 보이스 우선, 그다음 아무 ja 보이스
    jaVoice = ja.find((v) => v.localService) ?? ja[0] ?? null;
    // 보이스 목록이 아직 비어 있으면 다음 호출에서 다시 찾는다
    if (voices.length === 0) jaVoice = undefined;
  } catch {
    jaVoice = null;
  }
  return jaVoice ?? null;
}

const VOICE_PRESET: Record<SpeakVoice, { pitch: number; rate: number }> = {
  clerk: { pitch: 1.1, rate: 1.0 },
  customer: { pitch: 0.9, rate: 0.95 },
};

/** 일본어 문장을 읽는다. 직전 발화는 취소한다. */
export function speakJa(text: string, opts: SpeakOptions = {}): void {
  if (!isBrowser() || !isAudioEnabled()) return;
  if (!text.trim()) return;
  const synth = window.speechSynthesis;
  if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;
  try {
    synth.cancel();
    const preset = VOICE_PRESET[opts.voice ?? "clerk"];
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = opts.rate ?? preset.rate;
    u.pitch = opts.pitch ?? preset.pitch;
    const v = pickJaVoice();
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    /* noop */
  }
}

/** 진행 중인 TTS 를 멈춘다 */
export function stopSpeaking(): void {
  if (!isBrowser()) return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* noop */
  }
}
