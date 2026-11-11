"use client";

/**
 * localStorage 세이브 복원 → 서버 동기화 → 프로필 변경 자동 푸시.
 * 렌더는 항상 children 그대로(SSR 과 첫 클라이언트 렌더는 기본 상태로 일치),
 * 복원 완료 여부는 각 화면이 `useGameStore(s => s.hydrated)` 로 읽어 스켈레톤을 결정한다.
 */
import { useEffect, type ReactNode } from "react";
import { useGameStore } from "./gameStore";
import { pushProfile, syncOnStart } from "./sync";

const PUSH_DEBOUNCE_MS = 1500;

export function SaveSync({ children }: { children: ReactNode }) {
  const hydrated = useGameStore((s) => s.hydrated);

  // 1) 세이브 복원 (스토어는 skipHydration 이라 여기서 명시적으로)
  useEffect(() => {
    void useGameStore.persist.rehydrate();
  }, []);

  // 2) 복원 후 서버 동기화 1회
  useEffect(() => {
    if (!hydrated) return;
    void syncOnStart();
  }, [hydrated]);

  // 3) 프로필이 바뀌면 디바운스해서 서버에 올린다 (시프트 종료는 pushShiftResult 가 따로 처리)
  useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastUpdatedAt = useGameStore.getState().profile.updatedAt;
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.profile.updatedAt === lastUpdatedAt) return;
      lastUpdatedAt = state.profile.updatedAt;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void pushProfile(), PUSH_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [hydrated]);

  return <>{children}</>;
}
