"use client";

/**
 * BAITO 클라이언트 상태 — 로컬 우선(localStorage) 세이브.
 * 서버(Supabase) 동기화는 ./sync.ts 가 이 스토어를 구독해 처리한다.
 *
 * 저장되는 것: 플레이어 프로필(이력서), 최근 영수증(시프트 요약), 오디오 설정, 전송 대기 세션.
 * 저장되지 않는 것: 진행 중인 시프트 상태(새로고침하면 시프트는 처음부터).
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ItemTag, ShiftSummary, TagWeights } from "@/engine/types";
import { ITEM_TAGS } from "@/engine/types";
import { bumpAffinity, updateStreak, weekStartOf } from "@/engine/progression";
import {
  DEFAULT_WAGE,
  LEAVES_PER_MONTH,
  normalizeProfile,
  type PlayerProfile,
  type RegularState,
} from "@/shared/player";
import type { DataBackend } from "@/shared/api";
import { localYm, localYmd } from "./date";

export const SAVE_KEY = "baito.save.v1";
/** 영수증은 최근 20장만 로컬에 둔다 (서버에는 전부 저장) */
const MAX_LOCAL_SESSIONS = 20;

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "unconfigured" | "error";

export interface SyncState {
  status: SyncStatus;
  backend: DataBackend | null;
  lastSyncedAt: string | null;
  /** 마지막 오류 메시지(디버그용, UI에는 노출하지 않음) */
  lastError: string | null;
}

export interface CompleteShiftInput {
  summary: ShiftSummary;
  /** 시프트 종료 시점의 SRS 가중치 */
  tagWeights: TagWeights;
  /** 이번 시프트에서 만난 레귤러 id */
  regularsMet: string[];
  /** 레귤러별로 이번에 들은 "처음 들은 말" */
  wordsHeard: Record<string, string[]>;
  /** 로컬 날짜 YYYY-MM-DD (테스트 주입용, 기본 오늘) */
  today?: string;
}

export interface GameState {
  profile: PlayerProfile;
  /** 최근 영수증, 최신 순 */
  sessions: ShiftSummary[];
  /** 서버 전송에 실패해 재시도 대기 중인 세션 */
  pendingSessions: ShiftSummary[];
  audioEnabled: boolean;
  /** localStorage 복원 완료 여부 (SSR 불일치 방지) */
  hydrated: boolean;
  sync: SyncState;
}

export interface GameActions {
  setName: (name: string) => void;
  completeShift: (input: CompleteShiftInput) => ShiftSummary;
  setAudioEnabled: (enabled: boolean) => void;
  markHydrated: () => void;
  /** 서버 프로필이 더 최신이면 교체 */
  mergeServerProfile: (server: PlayerProfile) => boolean;
  /** 서버에서 받은 영수증 목록 병합(중복 제거, 최신 순) */
  mergeServerSessions: (sessions: ShiftSummary[]) => void;
  setSyncState: (patch: Partial<SyncState>) => void;
  enqueuePendingSession: (summary: ShiftSummary) => void;
  dequeuePendingSession: (playedAt: string) => void;
  /** 개발·QA용: 세이브 초기화 */
  resetAll: () => void;
}

export type GameStore = GameState & GameActions;

function initialTagWeights(): TagWeights {
  return Object.fromEntries(ITEM_TAGS.map((t) => [t, 1])) as TagWeights;
}

export function createDefaultProfile(now: Date = new Date()): PlayerProfile {
  return {
    name: "알바생",
    wage: DEFAULT_WAGE,
    totalShifts: 0,
    rank: "shinjin",
    examWeek: null,
    streak: 0,
    lastPlayDate: null,
    leavesLeft: LEAVES_PER_MONTH,
    leaveMonth: localYm(now),
    tagWeights: initialTagWeights(),
    perfectedTags: [],
    regulars: {},
    today: { date: localYmd(now), completed: [] },
    updatedAt: now.toISOString(),
  };
}

const defaultRegularState: RegularState = {
  affinity: 0,
  metCount: 0,
  lastMetDate: null,
  firstWordsHeard: [],
};

const initialState: GameState = {
  profile: createDefaultProfile(),
  sessions: [],
  pendingSessions: [],
  audioEnabled: true,
  hydrated: false,
  sync: { status: "idle", backend: null, lastSyncedAt: null, lastError: null },
};

/** 시프트 요약을 프로필에 반영한다 (순수 함수 — 테스트 가능) */
export function applyShiftToProfile(profile: PlayerProfile, input: CompleteShiftInput): PlayerProfile {
  const today = input.today ?? localYmd();
  const { summary } = input;

  const streak = updateStreak(
    {
      streak: profile.streak,
      lastPlayDate: profile.lastPlayDate,
      leavesLeft: profile.leavesLeft,
      leaveMonth: profile.leaveMonth,
    },
    today,
  );

  const todayProgress =
    profile.today.date === today ? profile.today : { date: today, completed: [] };
  // 승급 시험은 오늘 시프트 표의 칸을 채우지 않는다(추가 근무)
  const completed =
    summary.exam || todayProgress.completed.includes(summary.slot)
      ? todayProgress.completed
      : [...todayProgress.completed, summary.slot];

  // 승급 시험: 이번 주 응시 기록, 합격이면 직급 상승
  const examWeek = summary.exam ? weekStartOf(today) : profile.examWeek;
  const rank = summary.exam?.passed ? summary.exam.rank : profile.rank;

  const regulars: Record<string, RegularState> = { ...profile.regulars };
  for (const id of input.regularsMet) {
    const prev = regulars[id] ?? defaultRegularState;
    const bumped = bumpAffinity(prev, today);
    const heard = input.wordsHeard[id] ?? [];
    regulars[id] = {
      ...bumped,
      firstWordsHeard: Array.from(new Set([...bumped.firstWordsHeard, ...heard])),
    };
  }

  const perfectedTags: ItemTag[] = Array.from(
    new Set([...profile.perfectedTags, ...summary.firstSuccessTags]),
  );

  return {
    ...profile,
    wage: summary.wageAfter,
    totalShifts: profile.totalShifts + 1,
    rank,
    examWeek,
    streak: streak.streak,
    lastPlayDate: today,
    leavesLeft: streak.leavesLeft,
    leaveMonth: streak.leaveMonth,
    tagWeights: input.tagWeights,
    perfectedTags,
    regulars,
    today: { date: today, completed },
    updatedAt: new Date().toISOString(),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setName: (name) =>
        set((s) => ({
          profile: {
            ...s.profile,
            name: name.trim().slice(0, 20) || "알바생",
            updatedAt: new Date().toISOString(),
          },
        })),

      completeShift: (input) => {
        const profile = applyShiftToProfile(get().profile, input);
        set((s) => ({
          profile,
          sessions: [input.summary, ...s.sessions].slice(0, MAX_LOCAL_SESSIONS),
        }));
        return input.summary;
      },

      setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),

      markHydrated: () => set({ hydrated: true }),

      mergeServerProfile: (server) => {
        const local = get().profile;
        if (new Date(server.updatedAt).getTime() <= new Date(local.updatedAt).getTime()) {
          return false;
        }
        set({ profile: normalizeProfile(server) });
        return true;
      },

      mergeServerSessions: (incoming) => {
        set((s) => {
          const byKey = new Map<string, ShiftSummary>();
          for (const item of [...incoming, ...s.sessions]) {
            byKey.set(`${item.playedAt}|${item.slot}`, item);
          }
          const merged = Array.from(byKey.values()).sort(
            (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime(),
          );
          return { sessions: merged.slice(0, MAX_LOCAL_SESSIONS) };
        });
      },

      setSyncState: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),

      enqueuePendingSession: (summary) =>
        set((s) => ({
          pendingSessions: s.pendingSessions.some((p) => p.playedAt === summary.playedAt)
            ? s.pendingSessions
            : [...s.pendingSessions, summary],
        })),

      dequeuePendingSession: (playedAt) =>
        set((s) => ({
          pendingSessions: s.pendingSessions.filter((p) => p.playedAt !== playedAt),
        })),

      resetAll: () =>
        set({
          ...initialState,
          profile: createDefaultProfile(),
          hydrated: true,
        }),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      /** SSR 안전: 클라이언트에서 명시적으로 rehydrate() 호출 (HydrationGate 참조) */
      skipHydration: true,
      partialize: (s) => ({
        profile: s.profile,
        sessions: s.sessions,
        pendingSessions: s.pendingSessions,
        audioEnabled: s.audioEnabled,
      }),
      /** 예전 버전 세이브(새 태그·직급 필드 없음)를 현재 계약으로 맞춘다 */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameState>;
        return {
          ...current,
          ...saved,
          profile: normalizeProfile({ ...current.profile, ...(saved.profile ?? {}) }),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
