import { SHIFT_SLOTS, type ShiftSlot } from "@/engine/types";

/**
 * 인게임 라우트의 slot 파라미터 — 시간대 4종 + 승급 시험("exam").
 * "use client" 가 없는 모듈이라 서버 컴포넌트(page.tsx 의 generateStaticParams)에서도 import 할 수 있다.
 */
export const EXAM_SLOT = "exam" as const;
export type GameSlot = ShiftSlot | typeof EXAM_SLOT;
export const GAME_SLOTS: readonly GameSlot[] = [...SHIFT_SLOTS, EXAM_SLOT];

export function isGameSlot(value: string): value is GameSlot {
  return (GAME_SLOTS as readonly string[]).includes(value);
}
