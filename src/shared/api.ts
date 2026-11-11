/**
 * Next.js API Route(/api/*) 와 클라이언트가 공유하는 DTO.
 * 서버는 zod 로 검증한 뒤 이 타입으로 응답한다.
 */
import type { ShiftSummary } from "@/engine/types";
import type { PlayerProfile } from "./player";

/** 모든 오류 응답의 공통 형태 */
export interface ApiErrorBody {
  error: {
    /** 기계가 읽는 코드. 예: VALIDATION_ERROR, NOT_FOUND, SUPABASE_NOT_CONFIGURED */
    code: string;
    /** 사람이 읽는 메시지(한국어) */
    message: string;
    details?: unknown;
  };
}

export type DataBackend = "supabase" | "memory";

/** GET /api/health */
export interface HealthDTO {
  ok: true;
  backend: DataBackend;
  time: string;
}

/** GET /api/profile · PUT /api/profile */
export interface ProfileDTO {
  playerId: string;
  profile: PlayerProfile;
}

/** POST /api/sessions 요청 본문 */
export interface CreateSessionBody {
  summary: ShiftSummary;
}

export interface SessionDTO {
  id: string;
  playerId: string;
  createdAt: string;
  summary: ShiftSummary;
}

/** GET /api/sessions */
export interface SessionsListDTO {
  sessions: SessionDTO[];
}

export interface LeagueEntryDTO {
  playerId: string;
  name: string;
  /** 이번 주 시급 변동 합계(¥) */
  weeklyWageDelta: number;
  /** 이번 주 완료 시프트 수 */
  shifts: number;
  /** 현재 시급(¥) */
  wage: number;
  rank: number;
  isMe: boolean;
}

/** GET /api/league */
export interface LeagueDTO {
  /** 이번 주 월요일 (YYYY-MM-DD) */
  weekStart: string;
  entries: LeagueEntryDTO[];
  me: LeagueEntryDTO | null;
}
