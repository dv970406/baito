/**
 * 클라이언트 전용 오디오 헬퍼. SSR 안전 — 모든 함수는 window 가 없으면 아무 일도 하지 않는다.
 * - speakJa: Web Speech API 로 일본어 읽기
 * - playSfx: AudioContext 로 짧은 합성 효과음
 * - setAudioEnabled / isAudioEnabled: localStorage(`baito.audio`) 에 on/off 저장
 * - unlockAudio: 첫 사용자 제스처에서 호출해 AudioContext 를 깨운다
 * - startComboLayer / stopComboLayer: 콤보가 이어질 때 깔리는 아주 작은 리듬 레이어(하이햇 → 베이스)
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
  /** 발화 언어 (기본 ja-JP). 관광객의 영어 대사는 "en-US" */
  lang?: string;
}

/** 콤보 BGM 레이어 단계: 0 없음 · 1 하이햇 틱 · 2 하이햇 + 베이스 펄스 */
export type ComboLayerLevel = 0 | 1 | 2;
/** 레이어가 켜지는 콤보 수 */
export const COMBO_LAYER_THRESHOLDS: Readonly<Record<1 | 2, number>> = { 1: 5, 2: 10 };

/** 콤보 수 → 레이어 단계 */
export function comboLayerLevel(combo: number): ComboLayerLevel {
  if (combo >= COMBO_LAYER_THRESHOLDS[2]) return 2;
  if (combo >= COMBO_LAYER_THRESHOLDS[1]) return 1;
  return 0;
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
    stopComboLayer();
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

/**
 * 효과음 테이블. 등급음은 셋이 귀로 구분되게:
 * - perfect: 빠르게 올라가는 두 음(E6→A6 치프 + 높은 핑) — 밝고 짧다
 * - good: 한 음만 살짝 올라감 — perfect 보다 낮고 짧다
 * - late: 낮고 평평한 한 음, 끝이 살짝 내려간다 — "늦었다"는 느낌
 */
const SFX: Record<SfxKind, Tone[]> = {
  perfect: [
    { freq: 1318.5, to: 1760, ms: 90, type: "triangle", gain: 0.22 },
    { freq: 2093, ms: 140, at: 80, type: "sine", gain: 0.16 },
  ],
  good: [{ freq: 784, to: 988, ms: 110, type: "triangle", gain: 0.18 }],
  late: [{ freq: 392, to: 370, ms: 160, type: "sine", gain: 0.16 }],
  wrong: [{ freq: 220, ms: 150, type: "square", gain: 0.12 }],
  // 편의점 입점 차임 「ピンポーン」: 높은 음 → 낮은 음, 두 번째 음이 길게 울린다.
  // 사인에 옅은 삼각파를 겹쳐 종 느낌을 낸다.
  chime: [
    { freq: 1318.5, ms: 260, type: "sine", gain: 0.2 },
    { freq: 1318.5, ms: 220, type: "triangle", gain: 0.05 },
    { freq: 1046.5, ms: 620, at: 300, type: "sine", gain: 0.2 },
    { freq: 1046.5, ms: 520, at: 300, type: "triangle", gain: 0.05 },
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

/* ───────────── 콤보 BGM 레이어 ───────────── */

/** 템포(BPM)와 스케줄러 설정 — 아주 작은 볼륨의 리듬 레이어 */
const LAYER_BPM = 112;
const LAYER_BEAT_SEC = 60 / LAYER_BPM;
/** 스케줄러 틱 간격(ms)과 미리 예약하는 길이(초) */
const LAYER_TICK_MS = 100;
const LAYER_LOOKAHEAD_SEC = 0.25;
/** 레이어 전체 볼륨 — 효과음 밑에 깔리는 정도 */
const LAYER_GAIN = { 1: 0.035, 2: 0.045 } as const;
const LAYER_FADE_SEC = { in: 0.4, out: 0.6 } as const;

interface ComboLayer {
  level: 1 | 2;
  master: GainNode;
  timer: ReturnType<typeof setInterval>;
  /** 다음에 예약할 8분음표 시각(AudioContext 시간) */
  nextTime: number;
  /** 8분음표 카운터 (짝수 = 정박) */
  step: number;
}

let layer: ComboLayer | null = null;
let noiseBuffer: AudioBuffer | null = null;
let visibilityBound = false;

/** 하이햇용 짧은 화이트 노이즈 버퍼(60ms) */
function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const length = Math.floor(c.sampleRate * 0.06);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** 하이햇 틱: 노이즈 → 하이패스 → 짧은 감쇠 */
function scheduleHat(c: AudioContext, out: GainNode, at: number, accent: boolean): void {
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = c.createGain();
  gain.gain.setValueAtTime(accent ? 1 : 0.55, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(at);
  src.stop(at + 0.06);
}

/** 베이스 펄스: 낮은 사인 한 음, 피치가 살짝 내려가며 꺼진다 */
function scheduleBass(c: AudioContext, out: GainNode, at: number): void {
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(82.4, at); // E2
  osc.frequency.exponentialRampToValueAtTime(55, at + 0.18);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(1, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  osc.connect(gain);
  gain.connect(out);
  osc.start(at);
  osc.stop(at + 0.25);
}

/** 스케줄러 한 틱: 미리보기 창 안의 8분음표를 전부 예약한다 */
function scheduleLayer(c: AudioContext): void {
  const current = layer;
  if (!current) return;
  while (current.nextTime < c.currentTime + LAYER_LOOKAHEAD_SEC) {
    const onBeat = current.step % 2 === 0;
    scheduleHat(c, current.master, current.nextTime, onBeat);
    // 레벨 2: 1·3박(step 0, 4)에 베이스
    if (current.level >= 2 && current.step % 4 === 0) scheduleBass(c, current.master, current.nextTime);
    current.nextTime += LAYER_BEAT_SEC / 2;
    current.step = (current.step + 1) % 8;
  }
}

/** 탭이 숨겨지면 레이어를 멈춘다(배경 재생 금지). 한 번만 바인딩 */
function bindVisibility(): void {
  if (visibilityBound || !isBrowser() || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopComboLayer();
  });
}

/**
 * 콤보 레이어 시작/단계 변경. unlockAudio 이후(AudioContext 가 깨어 있을 때)만 소리가 난다.
 * - level 1: 하이햇 틱(8분음표) · level 2: 하이햇 + 베이스 펄스
 * - 이미 같은 단계가 재생 중이면 아무 일도 하지 않는다. 다른 단계면 리듬 위치를 유지하며 바꾼다.
 * - 오디오 설정이 꺼져 있으면 시작하지 않는다.
 */
export function startComboLayer(level: ComboLayerLevel): void {
  if (level === 0) {
    stopComboLayer();
    return;
  }
  if (!isBrowser() || !isAudioEnabled()) return;
  const c = ctx; // 여기서 새 컨텍스트를 만들지 않는다 — unlockAudio 가 먼저여야 한다
  if (!c || c.state !== "running") return;
  try {
    if (layer) {
      if (layer.level === level) return;
      layer.level = level;
      layer.master.gain.setTargetAtTime(LAYER_GAIN[level], c.currentTime, 0.1);
      return;
    }
    bindVisibility();
    const master = c.createGain();
    master.gain.setValueAtTime(0.0001, c.currentTime);
    master.gain.linearRampToValueAtTime(LAYER_GAIN[level], c.currentTime + LAYER_FADE_SEC.in);
    master.connect(c.destination);
    layer = {
      level,
      master,
      nextTime: c.currentTime + 0.05,
      step: 0,
      timer: setInterval(() => {
        try {
          scheduleLayer(c);
        } catch {
          stopComboLayer();
        }
      }, LAYER_TICK_MS),
    };
    scheduleLayer(c);
  } catch {
    layer = null;
  }
}

/** 콤보 레이어를 페이드아웃하며 멈춘다. 재생 중이 아니면 아무 일도 하지 않는다 */
export function stopComboLayer(): void {
  const current = layer;
  if (!current) return;
  layer = null;
  clearInterval(current.timer);
  try {
    const c = ctx;
    const now = c?.currentTime ?? 0;
    current.master.gain.cancelScheduledValues(now);
    current.master.gain.setValueAtTime(current.master.gain.value, now);
    current.master.gain.linearRampToValueAtTime(0.0001, now + LAYER_FADE_SEC.out);
    const master = current.master;
    setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* noop */
      }
    }, LAYER_FADE_SEC.out * 1000 + 100);
  } catch {
    /* noop */
  }
}

/** 지금 재생 중인 레이어 단계(테스트·디버그용) */
export function currentComboLayer(): ComboLayerLevel {
  return layer?.level ?? 0;
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
    const lang = opts.lang ?? "ja-JP";
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = opts.rate ?? preset.rate;
    u.pitch = opts.pitch ?? preset.pitch;
    // 일본어일 때만 ja 보이스를 고른다. 영어(관광객)는 브라우저가 lang 에 맞는 기본 보이스를 쓴다
    const v = lang.toLowerCase().startsWith("ja") ? pickJaVoice() : null;
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
