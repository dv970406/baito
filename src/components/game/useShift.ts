"use client";

/**
 * 엔진의 순수 reducer(shiftReducer)를 React 에 연결하는 훅.
 * - requestAnimationFrame 으로 TICK 을 보내고, 탭이 숨겨지면 멈춘다(지하철 플레이 시나리오).
 * - 상태 전이 자체는 전부 엔진 안에서 일어나므로 이 훅은 "시계"와 "입력"만 담당한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemTag, Regular, ShiftConfig, ShiftState, TagWeights, WorkplaceContent } from "@/engine/types";
import { createShift, shiftReducer } from "@/engine/shift";

export interface UseShiftOptions {
  content: WorkplaceContent;
  config: ShiftConfig;
  seed: number;
  tagWeights: TagWeights;
  regularsAvailable: Regular[];
  unlockedTags: ItemTag[];
}

/** 한 프레임에 반영하는 최대 경과 시간(ms). 탭 복귀 직후 타이머가 한꺼풀 튀는 것을 막는다. */
const MAX_FRAME_MS = 120;

export function useShift(opts: UseShiftOptions) {
  const { content } = opts;
  const [state, setState] = useState<ShiftState>(() => createShift(opts));
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  // 최신 상태 참조 — 렌더 중 쓰지 않고(react-hooks/refs) 커밋 후 동기화한다
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const dispatch = useCallback(
    (event: Parameters<typeof shiftReducer>[1]) => {
      setState((prev) => {
        const next = shiftReducer(prev, event, content);
        stateRef.current = next;
        return next;
      });
    },
    [content],
  );

  const start = useCallback(() => {
    if (started) return;
    setStarted(true);
    dispatch({ type: "START" });
  }, [dispatch, started]);

  const answer = useCallback(
    (phraseId: string) => {
      if (stateRef.current.phase !== "question") return;
      dispatch({ type: "ANSWER", phraseId });
    },
    [dispatch],
  );

  const skip = useCallback(() => dispatch({ type: "SKIP_PHASE" }), [dispatch]);

  // 시계: rAF 루프. done 이면 멈춘다.
  useEffect(() => {
    if (!started || paused || state.phase === "done") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(MAX_FRAME_MS, now - last);
      last = now;
      if (dt > 0) dispatch({ type: "TICK", dtMs: dt });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, paused, state.phase, dispatch]);

  // 탭이 숨겨지면 자동 일시정지, 돌아오면 재개
  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { state, started, paused, setPaused, start, answer, skip };
}
