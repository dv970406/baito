"use client";

/**
 * 시프트 보드 — useShift(엔진 시계)와 화면(HUD · 씬 · POS · 오버레이)을 잇는다.
 * 상태 전이는 전부 엔진 안에서 일어나고, 이 컴포넌트는 그 전이를 "보고" 효과음·TTS·플래시를 낸다.
 * 마감(phase done)에서는 summarize → completeShift(1회) → sessionStorage → 서버 전송 → 영수증으로 이동.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CustomerReply,
  ExamContext,
  ItemTag,
  ManagerLine,
  Regular,
  ShiftSlot,
  ShiftState,
  ShiftSummary,
  WorkplaceContent,
} from "@/engine/types";
import { currentKind, currentPrompt, questionRemainingMs, shiftProgress, summarize } from "@/engine/shift";
import { PATIENCE_MAX } from "@/engine/scoring";
import {
  comboLayerLevel,
  playSfx,
  speakJa,
  startComboLayer,
  stopComboLayer,
  stopSpeaking,
  unlockAudio,
} from "@/lib/audio";
import { isSpeechRecognitionSupported, listenOnce, matchSpoken, type ListenSession } from "@/lib/speech";
import { Screen } from "@/components/ui";
import { useGameStore } from "@/store/gameStore";
import { pushShiftResult } from "@/store/sync";
import { PosPanel } from "./PosPanel";
import { SceneStage, type GradeFlash } from "./SceneStage";
import { ShiftHud } from "./ShiftHud";
import { PauseOverlay, PreShiftSheet, ShiftEndOverlay } from "./ShiftOverlays";
import {
  anonymousVisual,
  customerName,
  defaultShowKana,
  pickFirstWords,
  pickManagerLine,
  regularLeaveLine,
  saveLastReceipt,
  SHOW_KANA_KEY,
  SHOW_KO_KEY,
  tobaccoShelfNumbers,
} from "./shiftModel";
import { useShift } from "./useShift";

export interface ShiftBoardProps {
  content: WorkplaceContent;
  slot: ShiftSlot;
  seed: number;
  regularsAvailable: Regular[];
  unlockedTags: ItemTag[];
  /** 말하기 모드 해금 여부(직급·레벨). 브라우저 지원 여부는 보드가 따로 본다 */
  speakingUnlocked?: boolean;
  /** 플레이 중인 달(1~12) — 시즌 상품·포스터·규칙 */
  month?: number;
  /** 승급 시험(점장 점검 시프트)이면 그 정보 */
  exam?: ExamContext | null;
}

/** 말하기 버튼 상태 */
export type SpeechUiState = "hidden" | "locked" | "ready" | "listening";

/** 음성 인식이 이 시간 안에 끝나지 않으면 버튼으로 돌아간다(ms) */
const LISTEN_TIMEOUT_MS = 6000;

const SPEECH_NOTE: Record<string, string> = {
  "not-allowed": "마이크 권한이 필요해요 · 버튼으로 골라 주세요",
  ambiguous: "もう一度 · 어느 쪽인지 애매해요, 버튼으로 골라도 돼요",
  default: "もう一度 · 못 알아들었어요, 버튼으로 골라도 돼요",
};

/** 마감 오버레이가 보이는 시간(ms). 점장 호출은 한마디를 읽을 시간을 더 준다 */
const END_DELAY_MS = { normal: 1400, manager: 2800 } as const;
const RECEIPT_PATH = "/konbini/receipt?latest=1";
const HOME_PATH = "/konbini";

/**
 * 단계별 말풍선: 입장 = 레귤러 첫마디, 질문 = 손님의 요구(LISTEN·담배 번호·돌발 이벤트) 또는 레귤러 첫마디,
 * 응답 = 엔진 말풍선, 퇴장 = 이탈 대사 또는 레귤러 호감도 대사
 */
function resolveBubble(
  state: ShiftState,
  enterWords: CustomerReply | null,
  regular: Regular | undefined,
  affinity: number,
): CustomerReply | null {
  switch (state.phase) {
    case "enter":
      return enterWords;
    case "question": {
      // 손님이 먼저 말한 요구가 있으면 그것이 곧 문제다 — 재시도 중에도 계속 보인다
      const prompt = currentPrompt(state);
      if (prompt) return prompt;
      // 레귤러의 첫마디(「袋いい」 같은 단서)는 첫 질문에 답할 때까지 남겨 둔다
      return state.stepIndex === 0 && state.wrongOnStep === 0 ? enterWords : null;
    }
    case "reply":
      return state.bubble;
    case "leave":
      if (state.bubble) return state.bubble;
      if (regular && state.mood === "happy") return regularLeaveLine(regular, affinity);
      return null;
    default:
      return null;
  }
}

function readShowKo(): boolean {
  try {
    return window.localStorage.getItem(SHOW_KO_KEY) === "1";
  } catch {
    return false;
  }
}

/** 후리가나 초기값 — 저장값 우선, 없으면 Lv1~2 ON · Lv3+ OFF */
function readShowKana(level: number): boolean {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(SHOW_KANA_KEY);
  } catch {
    stored = null;
  }
  return defaultShowKana(level, stored);
}

function persistFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function ShiftBoard({
  content,
  slot,
  seed,
  regularsAvailable,
  unlockedTags,
  speakingUnlocked = false,
  month,
  exam = null,
}: ShiftBoardProps) {
  const router = useRouter();
  const config = content.shifts[slot];
  const audioEnabled = useGameStore((s) => s.audioEnabled);
  const regularStates = useGameStore((s) => s.profile.regulars);
  // 시프트 시작 시점의 SRS 가중치 — 초기화에만 쓰이므로 한 번만 읽는다
  const [initialTagWeights] = useState(() => useGameStore.getState().profile.tagWeights);

  const { state, started, paused, setPaused, start, answer, skip } = useShift({
    content,
    config,
    seed,
    tagWeights: initialTagWeights,
    regularsAvailable,
    unlockedTags,
    month,
    exam,
  });

  const [pressedId, setPressedId] = useState<string | null>(null);
  const [gradeFlash, setGradeFlash] = useState<GradeFlash | null>(null);
  // 이 컴포넌트는 복원 뒤 클라이언트에서만 마운트되므로 초기값을 localStorage 에서 바로 읽어도 안전하다
  const [showKo, setShowKo] = useState<boolean>(() => (typeof window === "undefined" ? false : readShowKo()));
  const [showKana, setShowKana] = useState<boolean>(() =>
    typeof window === "undefined" ? defaultShowKana(config.level, null) : readShowKana(config.level),
  );
  const [manualPaused, setManualPaused] = useState(false);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);

  /* ───────── 말하기 모드 ───────── */
  // 복원 뒤 클라이언트에서만 마운트되므로 지원 여부를 바로 읽는다
  const [speechSupported] = useState(() => isSpeechRecognitionSupported());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const listenRef = useRef<ListenSession | null>(null);
  // 방금 답이 음성으로 들어왔으면 TTS 로 다시 읽지 않는다(플레이어가 이미 말했다)
  const spokenAnswerRef = useRef(false);

  const toggleKo = useCallback(() => {
    setShowKo((prev) => {
      const next = !prev;
      persistFlag(SHOW_KO_KEY, next);
      return next;
    });
  }, []);
  const toggleKana = useCallback(() => {
    setShowKana((prev) => {
      const next = !prev;
      persistFlag(SHOW_KANA_KEY, next);
      return next;
    });
  }, []);

  /* ───────── 파생 값 ───────── */
  const customer = state.customer;
  const regular = customer?.regularId ? content.regulars.find((r) => r.id === customer.regularId) : undefined;
  const visual = regular?.visual ?? anonymousVisual(seed, customer?.index ?? 0);
  const enterWords: CustomerReply | null = regular && customer ? pickFirstWords(seed, customer.index, regular) : null;
  const bubble = resolveBubble(state, enterWords, regular, regularStates[regular?.id ?? ""]?.affinity ?? 0);

  const kind = currentKind(state);
  const showPayment = kind === "PAY" && (state.phase === "question" || state.phase === "reply");
  // 담배를 다루는 시프트면 뒷벽에 담배 선반 — 지금 선택지에 있는 번호는 빼서 정답이 보이지 않게 한다
  const tobaccoShelf = state.activeTags.includes("tobacco")
    ? tobaccoShelfNumbers(kind === "TOBACCO_PICK" ? state.options : [], customer?.tobaccoNumber ?? null)
    : [];
  const skippable = started && !paused && (state.phase === "enter" || state.phase === "reply" || state.phase === "leave");
  const questionTotalMs = config.questionTimeSec * 1000;

  /* ───────── 전이 감지: 효과음 · TTS · 플래시 · 처음 들은 말 기록 ───────── */
  const prevRef = useRef<ShiftState | null>(null);
  const wordsHeardRef = useRef<Map<string, Set<string>>>(new Map());
  const flashKey = useRef(0);
  // 마지막으로 읽어 준 손님 요구의 "손님:질문" 키 — 같은 질문 재시도에서 다시 읽지 않기 위해
  const spokenPromptRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (!prev || !state.started) return;
    const sfx = (k: Parameters<typeof playSfx>[0]) => audioEnabled && playSfx(k);

    // 새 손님 입장
    const newCustomer = state.customer && (state.customerIndex !== prev.customerIndex || !prev.started);
    if (newCustomer) {
      sfx("chime");
      setGradeFlash(null);
      setPressedId(null);
      if (state.customer?.regularId) {
        const reg = content.regulars.find((r) => r.id === state.customer?.regularId);
        const words = reg ? pickFirstWords(seed, state.customerIndex, reg) : null;
        if (reg && words) {
          const set = wordsHeardRef.current.get(reg.id) ?? new Set<string>();
          set.add(words.ja);
          wordsHeardRef.current.set(reg.id, set);
        }
      }
    }

    // 답변 1건 추가
    if (state.log.length > prev.log.length) {
      const entry = state.log[state.log.length - 1];
      const chosen = entry.chosenPhraseId ? prev.options.find((o) => o.phraseId === entry.chosenPhraseId) : undefined;
      if (entry.correct && entry.grade) {
        flashKey.current += 1;
        setGradeFlash({ grade: entry.grade, combo: state.combo, key: flashKey.current });
        sfx(entry.grade === "ok" ? "good" : entry.grade);
      } else {
        sfx("wrong");
      }
      if (chosen && audioEnabled && !spokenAnswerRef.current) speakJa(chosen.ja, { voice: "clerk" });
      spokenAnswerRef.current = false;
    }

    // 손님 반응
    if (state.mood === "gone" && prev.mood !== "gone") sfx("leave");
    if (state.phase === "leave" && prev.phase !== "leave" && state.mood === "happy") sfx("scan");

    // 질문이 (다시) 열리면 눌린 버튼 표시와 말하기 안내를 지운다
    if (state.phase === "question" && prev.phase !== "question") {
      setPressedId(null);
      setSpeechNote(null);
      // 손님이 먼저 말하는 질문(LISTEN·담배 번호·돌발 이벤트)은 새 질문이 열릴 때 한 번 읽어 준다(재시도 땐 생략)
      const promptKey = `${state.customerIndex}:${state.stepIndex}`;
      const prompt = currentPrompt(state);
      if (prompt && promptKey !== spokenPromptRef.current) {
        spokenPromptRef.current = promptKey;
        if (audioEnabled) {
          speakJa(prompt.ja, { voice: "customer", lang: state.customer?.tourist ? "en-US" : "ja-JP" });
        }
      }
    }
  }, [state, audioEnabled, content.regulars, seed]);

  /* ───────── 콤보 BGM 레이어: 콤보 5 에서 하이햇, 10 에서 베이스. 끊기면·멈추면·마감이면 페이드아웃 ───────── */
  const layerLevel = comboLayerLevel(state.combo);
  const layerActive = started && !paused && state.phase !== "done" && audioEnabled && layerLevel > 0;
  useEffect(() => {
    if (layerActive) startComboLayer(layerLevel);
    else stopComboLayer();
  }, [layerActive, layerLevel]);
  useEffect(() => () => stopComboLayer(), []);

  /* ───────── 입력 ───────── */
  const handleStart = useCallback(() => {
    unlockAudio();
    start();
  }, [start]);

  const handleAnswer = useCallback(
    (phraseId: string) => {
      if (state.phase !== "question") return;
      setPressedId(phraseId);
      answer(phraseId);
    },
    [answer, state.phase],
  );

  // 음성 결과가 돌아왔을 때 "사용자가 직접 멈춘 상태"인지 보기 위한 최신값
  const manualPausedRef = useRef(false);
  useEffect(() => {
    manualPausedRef.current = manualPaused;
  }, [manualPaused]);

  /** 마이크 버튼: 듣는 동안 시계를 멈추고(오버레이 없음), 결과를 선택지와 너그럽게 맞춘다 */
  const speak = useCallback(() => {
    if (state.phase !== "question" || listening || !speechSupported || !speakingUnlocked) return;
    unlockAudio();
    stopSpeaking();
    setSpeechNote(null);
    setInterim("");
    setListening(true);
    setPaused(true);
    const options = state.options.map((o) => ({ phraseId: o.phraseId, ja: o.ja }));
    const session = listenOnce({ onInterim: setInterim, timeoutMs: LISTEN_TIMEOUT_MS });
    listenRef.current = session;
    void session.result.then((res) => {
      if (listenRef.current !== session) return; // 취소됐거나 다른 세션으로 바뀜
      listenRef.current = null;
      setListening(false);
      setInterim("");
      if (!manualPausedRef.current) setPaused(false);
      if (res.error === "aborted") return;
      const match = res.transcripts.length > 0 ? matchSpoken(res.transcripts, options) : null;
      if (match) {
        spokenAnswerRef.current = true;
        setPressedId(match.phraseId);
        answer(match.phraseId, true);
        return;
      }
      const key = res.error === "not-allowed" ? "not-allowed" : res.transcripts.length > 0 ? "ambiguous" : "default";
      setSpeechNote(SPEECH_NOTE[key] ?? SPEECH_NOTE.default);
    });
  }, [answer, listening, setPaused, speakingUnlocked, speechSupported, state.options, state.phase]);

  const cancelListening = useCallback(() => {
    const session = listenRef.current;
    if (!session) return;
    listenRef.current = null;
    session.cancel();
    setListening(false);
    setInterim("");
  }, []);

  const pause = useCallback(() => {
    if (!started || state.phase === "done") return;
    cancelListening();
    setManualPaused(true);
    setPaused(true);
    stopSpeaking();
  }, [cancelListening, setPaused, started, state.phase]);
  const resume = useCallback(() => {
    setManualPaused(false);
    setPaused(false);
  }, [setPaused]);
  // 탭 전환으로 훅이 자동 재개해도, 사용자가 직접 멈춘 상태면 다시 멈춘다
  useEffect(() => {
    if (manualPaused && !paused) setPaused(true);
  }, [manualPaused, paused, setPaused]);

  const quit = useCallback(() => {
    cancelListening();
    stopSpeaking();
    router.push(HOME_PATH);
  }, [cancelListening, router]);

  // 언마운트 시 듣기 중단
  useEffect(() => () => listenRef.current?.cancel(), []);

  const speechUi: SpeechUiState = !speechSupported
    ? "hidden"
    : !speakingUnlocked
      ? "locked"
      : listening
        ? "listening"
        : "ready";

  /* ───────── 마감 ───────── */
  const completedRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goReceipt = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = null;
    router.replace(RECEIPT_PATH);
  }, [router]);

  useEffect(() => {
    if (state.phase !== "done" || completedRef.current) return;
    completedRef.current = true;
    stopSpeaking();
    const store = useGameStore.getState();
    const result = summarize(state, {
      workplaceId: content.id,
      wageBefore: store.profile.wage,
      perfectedTags: store.profile.perfectedTags,
      playedAt: new Date().toISOString(),
    });
    const wordsHeard: Record<string, string[]> = {};
    for (const [id, set] of wordsHeardRef.current) wordsHeard[id] = Array.from(set);
    store.completeShift({
      summary: result,
      tagWeights: state.tagWeights,
      regularsMet: state.regularsMet,
      wordsHeard,
    });
    saveLastReceipt(result);
    void pushShiftResult(result);
    setSummary(result);
    endTimerRef.current = setTimeout(
      () => router.replace(RECEIPT_PATH),
      result.endedBy === "manager" ? END_DELAY_MS.manager : END_DELAY_MS.normal,
    );
  }, [state, content.id, router]);

  useEffect(
    () => () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      stopSpeaking();
    },
    [],
  );

  // 마감 한마디: 시험이면 합격/불합격 대사, 점장 호출이면 shift_end_bad
  const endLine: ManagerLine | null = summary
    ? summary.exam
      ? pickManagerLine(content, summary.exam.passed ? "exam_pass" : "exam_fail", seed)
      : summary.endedBy === "manager"
        ? pickManagerLine(content, "shift_end_bad", seed)
        : null
    : null;

  /* ───────── 렌더 ───────── */
  return (
    <Screen
      tone="surface"
      theme={slot === "yoru" || slot === "shinya" ? "shinya" : undefined}
      workplace={content.id}
      className="h-dvh max-h-dvh overflow-hidden"
    >
      <ShiftHud
        config={config}
        progress={shiftProgress(state)}
        elapsedRatio={state.elapsedMs / (config.durationSec * 1000)}
        handled={state.served + state.missed}
        combo={state.combo}
        paused={paused}
        onPause={pause}
        exam={state.exam}
        maxCombo={state.maxCombo}
        missed={state.missed}
      />
      <SceneStage
        className="mt-3.5 h-[min(340px,40dvh)]"
        customerName={customer ? customerName(customer, regular) : "お客さん"}
        regular={regular}
        visual={visual}
        mood={state.mood}
        bubble={bubble}
        irritation={state.irritation}
        patienceMax={customer?.patienceMax ?? PATIENCE_MAX}
        items={customer?.items ?? []}
        payment={showPayment && customer ? customer.payment : null}
        gradeFlash={state.phase === "reply" || state.phase === "leave" ? gradeFlash : null}
        skippable={skippable}
        onSkip={skip}
        empty={!customer || state.phase === "done"}
        event={customer?.event ?? null}
        direction={customer?.direction ?? null}
        drunk={customer?.drunk ?? false}
        tourist={customer?.tourist ?? false}
        season={state.season}
        tobaccoShelf={tobaccoShelf}
      />
      <PosPanel
        registerLabel={content.registerLabel}
        total={customer?.total ?? null}
        phase={state.phase}
        kind={kind}
        options={state.options}
        pressedId={pressedId}
        wrongOnStep={state.wrongOnStep}
        stepIndex={state.stepIndex}
        stepCount={state.queue.length}
        questionRemainingMs={questionRemainingMs(state)}
        questionTotalMs={questionTotalMs}
        showKo={showKo}
        onToggleKo={toggleKo}
        showKana={showKana}
        onToggleKana={toggleKana}
        onAnswer={handleAnswer}
        speech={speechUi}
        interim={interim}
        speechNote={speechNote}
        onSpeak={speak}
      />

      {!started ? (
        <PreShiftSheet content={content} config={config} ready onStart={handleStart} exam={state.exam} season={state.season} />
      ) : null}
      {started && manualPaused && state.phase !== "done" ? <PauseOverlay onResume={resume} onQuit={quit} /> : null}
      {summary ? <ShiftEndOverlay endedBy={summary.endedBy} managerLine={endLine} exam={summary.exam} onContinue={goReceipt} /> : null}
    </Screen>
  );
}
