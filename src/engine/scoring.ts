/**
 * 채점 상수와 속도 등급.
 * "정답을 아는 것"과 "즉시 꺼내는 것"을 구분하기 위해 정답에도 속도 등급을 매긴다.
 */
import type { SpeedGrade } from "./types";

/** 짜증 게이지 기본 최대 칸 */
export const PATIENCE_MAX = 4;
/** Perfect 판정 기준 반응 시간(ms) */
export const PERFECT_MS = 1500;

/**
 * 속도 등급.
 * perfect ≤ 1500ms, good ≤ 제한시간의 40%, ok ≤ 75%, 그 외 late.
 */
export function gradeSpeed(reactionMs: number, questionTimeMs: number): SpeedGrade {
  if (reactionMs <= PERFECT_MS) return "perfect";
  if (reactionMs <= questionTimeMs * 0.4) return "good";
  if (reactionMs <= questionTimeMs * 0.75) return "ok";
  return "late";
}

/** 콤보 배율: 1 + floor(combo/5) × 0.25, 최대 2 */
export function comboMultiplier(combo: number): number {
  const safe = Math.max(0, Math.floor(combo));
  return Math.min(2, 1 + Math.floor(safe / 5) * 0.25);
}
