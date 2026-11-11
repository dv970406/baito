"use client";

/**
 * 서버 동기화 — API Route(/api/*) 와 로컬 스토어를 잇는다.
 * 원칙: 로컬이 진실, 서버는 백업·리더보드. 실패해도 게임은 멈추지 않는다.
 */
import type { ShiftSummary } from "@/engine/types";
import type {
  ApiErrorBody,
  HealthDTO,
  LeagueDTO,
  ProfileDTO,
  SessionDTO,
  SessionsListDTO,
} from "@/shared/api";
import type { PlayerProfile } from "@/shared/player";
import { useGameStore } from "./gameStore";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* 본문 없는 오류 */
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<HealthDTO>("/api/health"),
  getProfile: () => request<ProfileDTO>("/api/profile"),
  putProfile: (profile: PlayerProfile) =>
    request<ProfileDTO>("/api/profile", { method: "PUT", body: JSON.stringify(profile) }),
  listSessions: (limit = 10) => request<SessionsListDTO>(`/api/sessions?limit=${limit}`),
  createSession: (summary: ShiftSummary) =>
    request<SessionDTO>("/api/sessions", { method: "POST", body: JSON.stringify({ summary }) }),
  league: () => request<LeagueDTO>("/api/league"),
};

function markFailure(err: unknown) {
  const { setSyncState } = useGameStore.getState();
  if (err instanceof ApiError && err.status === 503) {
    setSyncState({ status: "unconfigured", lastError: err.message });
    return "unconfigured" as const;
  }
  if (err instanceof TypeError) {
    // fetch 네트워크 오류
    setSyncState({ status: "offline", lastError: err.message });
    return "offline" as const;
  }
  setSyncState({
    status: "error",
    lastError: err instanceof Error ? err.message : String(err),
  });
  return "error" as const;
}

/** 앱 시작 시: 서버 프로필을 받아 더 최신이면 반영하고, 아니면 로컬을 올린다. 대기 세션도 재전송. */
export async function syncOnStart(): Promise<void> {
  const store = useGameStore.getState();
  store.setSyncState({ status: "syncing" });
  try {
    const health = await api.health();
    store.setSyncState({ backend: health.backend });

    try {
      const remote = await api.getProfile();
      const replaced = useGameStore.getState().mergeServerProfile(remote.profile);
      if (!replaced) {
        await api.putProfile(useGameStore.getState().profile);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        await api.putProfile(useGameStore.getState().profile);
      } else {
        throw err;
      }
    }

    await flushPendingSessions();

    try {
      const list = await api.listSessions(20);
      useGameStore.getState().mergeServerSessions(list.sessions.map((s) => s.summary));
    } catch {
      /* 목록 실패는 치명적이지 않음 */
    }

    useGameStore.getState().setSyncState({
      status: "synced",
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (err) {
    markFailure(err);
  }
}

/** 프로필 변경을 서버에 올린다 (디바운스는 호출자가) */
export async function pushProfile(): Promise<void> {
  const store = useGameStore.getState();
  if (store.sync.status === "unconfigured") return;
  try {
    await api.putProfile(store.profile);
    store.setSyncState({ status: "synced", lastSyncedAt: new Date().toISOString(), lastError: null });
  } catch (err) {
    markFailure(err);
  }
}

/** 시프트 종료 직후: 프로필 → 세션 순서로 전송. 실패하면 세션은 대기열에. */
export async function pushShiftResult(summary: ShiftSummary): Promise<void> {
  const store = useGameStore.getState();
  if (store.sync.status === "unconfigured") {
    return;
  }
  try {
    await api.putProfile(store.profile);
    await api.createSession(summary);
    store.setSyncState({ status: "synced", lastSyncedAt: new Date().toISOString(), lastError: null });
  } catch (err) {
    const kind = markFailure(err);
    if (kind !== "unconfigured") {
      store.enqueuePendingSession(summary);
    }
  }
}

/** 대기열의 세션을 순서대로 재전송 */
export async function flushPendingSessions(): Promise<void> {
  const pending = [...useGameStore.getState().pendingSessions];
  for (const summary of pending) {
    try {
      await api.createSession(summary);
      useGameStore.getState().dequeuePendingSession(summary.playedAt);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // 프로필이 없어서 거절 → 프로필 먼저 올리고 한 번 더
        await api.putProfile(useGameStore.getState().profile);
        await api.createSession(summary);
        useGameStore.getState().dequeuePendingSession(summary.playedAt);
      } else {
        throw err;
      }
    }
  }
}
