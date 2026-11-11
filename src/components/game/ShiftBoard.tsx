"use client";

/**
 * 시프트 보드 — useShift(엔진 시계)와 화면(HUD · 씬 · POS · 오버레이)을 잇는다.
 * 상태 전이는 전부 엔진 안에서 일어나고, 이 컴포넌트는 그 전이를 "보고" 효과음·TTS·플래시를 낸다.
 * 마감(phase done)에서는 summarize → completeShift(1회) → sessionStorage → 서버 전송 → 영수증으로 이동.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerReply, ItemTag, Regular, ShiftSlot, ShiftState, ShiftSummary, WorkplaceContent } from "@/engine/types";
import { currentKind, questionRemainingMs, shiftProgress, summarize } from "@/engine/shift";
import { PATIENCE_MAX } from "@/engine/scoring";
import { playSfx, speakJa, stopSpeaking, unlockAudio } from "@/lib/audio";
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
  pickFirstWords,
  regularLeaveLine,
  saveLastReceipt,
  SHOW_KO_KEY,
} from "./shiftModel";
import { useShift } from "./useShift";

export interface ShiftBoardProps {
  content: WorkplaceContent;
  slot: ShiftSlot;
  seed: number;
  regularsAvailable: Regular[];
  unlockedTags: ItemTag[];
}

/** 마감 오버레이가 보이는 시간(ms). 점장 호출은 한마디를 읽을 시간을 더 준다 */
const END_DELAY_MS = { normal: 1400, manager: 2800 } as const;
const RECEIPT_PATH = "/konbini/receipt?latest=1";
const HOME_PATH = "/konbini";

/** 단계별 말풍선: 입장 = 레귤러 첫마디, 응답 = 엔진 말풍선, 퇴장 = 이탈 대사 또는 레귤러 호감도 대사 */
function resolveBubble(
  state: ShiftState,
  enterWords: CustomerReply | null,
  regular: Regular | undefined,
  affinity: number,
): CustomerReply | null {
  switch (state.phase) {
    case "enter":
      return enterWords;
    case "question":
      // 레귤러의 첫마디(「袋いい」 같은 단서)는 첫 질문에 답할 때까지 남겨 둔다
      return state.stepIndex === 0 && state.wrongOnStep === 0 ? enterWords : null;
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

export function ShiftBoard({ content, slot, seed, regularsAvailable, unlockedTags }: ShiftBoardProps) {
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
  });

  const [pressedId, setPressedId] = useState<string | null>(null);
  const [gradeFlash, setGradeFlash] = useState<GradeFlash | null>(null);
  // 이 컴포넌트는 복원 뒤 클라이언트에서만 마운트되므로 초기값을 localStorage 에서 바로 읽어도 안전하다
  const [showKo, setShowKo] = useState<boolean>(() => (typeof window === "undefined" ? false : readShowKo()));
  const [manualPaused, setManualPaused] = useState(false);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);

  const toggleKo = useCallback(() => {
    setShowKo((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SHOW_KO_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
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
  const skippable = started && !paused && (state.phase === "enter" || state.phase === "reply" || state.phase === "leave");
  const questionTotalMs = config.questionTimeSec * 1000;

  /* ───────── 전이 감지: 효과음 · TTS · 플래시 · 처음 들은 말 기록 ───────── */
  const prevRef = useRef<ShiftState | null>(null);
  const wordsHeardRef = useRef<Map<string, Set<string>>>(new Map());
  const flashKey = useRef(0);

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
      if (chosen && audioEnabled) speakJa(chosen.ja, { voice: "clerk" });
    }

    // 손님 반응
    if (state.mood === "gone" && prev.mood !== "gone") sfx("leave");
    if (state.phase === "leave" && prev.phase !== "leave" && state.mood === "happy") sfx("scan");

    // 질문이 (다시) 열리면 눌린 버튼 표시를 지운다
    if (state.phase === "question" && prev.phase !== "question") setPressedId(null);
  }, [state, audioEnabled, content.regulars, seed]);

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

  const pause = useCallback(() => {
    if (!started || state.phase === "done") return;
    setManualPaused(true);
    setPaused(true);
    stopSpeaking();
  }, [setPaused, started, state.phase]);
  const resume = useCallback(() => {
    setManualPaused(false);
    setPaused(false);
  }, [setPaused]);
  // 탭 전환으로 훅이 자동 재개해도, 사용자가 직접 멈춘 상태면 다시 멈춘다
  useEffect(() => {
    if (manualPaused && !paused) setPaused(true);
  }, [manualPaused, paused, setPaused]);

  const quit = useCallback(() => {
    stopSpeaking();
    router.push(HOME_PATH);
  }, [router]);

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

  const managerCallLine = content.manager.find((line) => line.when === "shift_end_bad") ?? null;

  /* ───────── 렌더 ───────── */
  return (
    <Screen
      tone="surface"
      theme={slot === "yoru" ? "shinya" : undefined}
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
      />
      <PosPanel
        registerLabel={content.registerLabel}
        total={customer?.total ?? null}
        phase={state.phase}
        options={state.options}
        pressedId={pressedId}
        wrongOnStep={state.wrongOnStep}
        stepIndex={state.stepIndex}
        stepCount={state.queue.length}
        questionRemainingMs={questionRemainingMs(state)}
        questionTotalMs={questionTotalMs}
        showKo={showKo}
        onToggleKo={toggleKo}
        onAnswer={handleAnswer}
      />

      {!started ? <PreShiftSheet content={content} config={config} ready onStart={handleStart} /> : null}
      {started && manualPaused && state.phase !== "done" ? <PauseOverlay onResume={resume} onQuit={quit} /> : null}
      {summary ? (
        <ShiftEndOverlay
          endedBy={summary.endedBy}
          managerLine={summary.endedBy === "manager" ? managerCallLine : null}
          onContinue={goReceipt}
        />
      ) : null}
    </Screen>
  );
}
