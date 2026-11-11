/**
 * 데이터 저장소 추상화. Route Handler 는 이 인터페이스만 보고,
 * 실제 구현(Supabase / 메모리)은 환경변수로 결정된다.
 */
import type { ShiftSummary } from "@/engine/types";
import type { LeagueDTO, SessionDTO } from "@/shared/api";
import type { PlayerProfile } from "@/shared/player";
import { resolveBackend } from "./env";
import { MemoryRepository } from "./repository.memory";
import { SupabaseRepository } from "./repository.supabase";

export interface Repository {
  /** 프로필 조회. 없으면 null */
  getProfile(playerId: string): Promise<PlayerProfile | null>;
  /**
   * 프로필 저장(last-write-wins).
   * 저장된 profile.updatedAt 이 들어온 것보다 새로우면 들어온 값을 무시하고 저장된 것을 돌려준다.
   */
  upsertProfile(playerId: string, profile: PlayerProfile): Promise<PlayerProfile>;
  /** 시프트 완료 기록 생성. 호출 전에 프로필 존재 여부는 라우트가 확인한다. */
  createSession(playerId: string, summary: ShiftSummary): Promise<SessionDTO>;
  /** 최신순(createdAt desc) 세션 목록 */
  listSessions(playerId: string, limit: number): Promise<SessionDTO[]>;
  /** [weekStart, weekEnd) 구간의 주간 리그. me 는 상위 30명 안에 있을 때만 채워진다. */
  getLeague(playerId: string, weekStart: Date, weekEnd: Date): Promise<LeagueDTO>;
}

/** 프로덕션에서 Supabase 키가 없을 때 — API 는 503 SUPABASE_NOT_CONFIGURED 로 응답한다 */
export class RepositoryUnavailableError extends Error {
  constructor(message = "데이터 백엔드가 설정되지 않았습니다.") {
    super(message);
    this.name = "RepositoryUnavailableError";
  }
}

let supabaseRepo: SupabaseRepository | null = null;

/** 현재 환경에 맞는 Repository 를 돌려준다. unconfigured 면 RepositoryUnavailableError */
export function getRepository(): Repository {
  const backend = resolveBackend();
  switch (backend) {
    case "memory":
      return MemoryRepository.shared();
    case "supabase":
      supabaseRepo ??= new SupabaseRepository();
      return supabaseRepo;
    case "unconfigured":
      throw new RepositoryUnavailableError();
  }
}
