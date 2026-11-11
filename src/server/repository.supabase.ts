/**
 * Supabase 구현. service_role 클라이언트로 players / shift_sessions 테이블과
 * weekly_league() 함수를 호출한다. jsonb 컬럼은 읽을 때 zod 로 다시 검증한다.
 */
import type { ShiftSummary } from "@/engine/types";
import type { LeagueDTO, LeagueEntryDTO, SessionDTO } from "@/shared/api";
import type { PlayerProfile } from "@/shared/player";
import { isIncomingOlder } from "./lww";
import type { Repository } from "./repository";
import { playerProfileSchema, shiftSummarySchema } from "./schemas";
import { getServiceClient } from "./supabase";
import { weekRangeFor } from "./week";

/** players 테이블 행(필요한 컬럼만) */
interface PlayerRow {
  id: string;
  profile: unknown;
}

/** shift_sessions 테이블 행(필요한 컬럼만) */
interface SessionRow {
  id: string;
  player_id: string;
  created_at: string;
  summary: unknown;
}

/** weekly_league() 반환 행 */
interface LeagueRow {
  player_id: string;
  name: string;
  wage: number;
  weekly_wage_delta: number | string;
  shifts: number | string;
}

/** Supabase 오류를 일반 Error 로 감싼다(스택·세부 내용은 서버 로그에만 남는다) */
function fail(context: string, error: { message: string; code?: string }): never {
  throw new Error(`[supabase] ${context}: ${error.code ?? ""} ${error.message}`.trim());
}

function toSessionDTO(row: SessionRow): SessionDTO {
  return {
    id: row.id,
    playerId: row.player_id,
    createdAt: new Date(row.created_at).toISOString(),
    summary: shiftSummarySchema.parse(row.summary),
  };
}

export class SupabaseRepository implements Repository {
  async getProfile(playerId: string): Promise<PlayerProfile | null> {
    const { data, error } = await getServiceClient()
      .from("players")
      .select("id, profile")
      .eq("id", playerId)
      .maybeSingle<PlayerRow>();
    if (error) fail("getProfile", error);
    if (!data) return null;
    return playerProfileSchema.parse(data.profile);
  }

  async upsertProfile(playerId: string, profile: PlayerProfile): Promise<PlayerProfile> {
    const stored = await this.getProfile(playerId);
    if (isIncomingOlder(stored, profile)) return stored as PlayerProfile;

    const { error } = await getServiceClient()
      .from("players")
      .upsert(
        {
          id: playerId,
          // 리그 집계용 미러 컬럼
          name: profile.name,
          wage: profile.wage,
          total_shifts: profile.totalShifts,
          profile,
        },
        { onConflict: "id" },
      );
    if (error) fail("upsertProfile", error);
    return profile;
  }

  async createSession(playerId: string, summary: ShiftSummary): Promise<SessionDTO> {
    const { data, error } = await getServiceClient()
      .from("shift_sessions")
      .insert({
        player_id: playerId,
        workplace_id: summary.workplaceId,
        slot: summary.slot,
        level: summary.level,
        played_at: summary.playedAt,
        wage_delta: summary.wageDelta,
        served: summary.served,
        missed: summary.missed,
        max_combo: summary.maxCombo,
        summary,
      })
      .select("id, player_id, created_at, summary")
      .single<SessionRow>();
    if (error) fail("createSession", error);
    return toSessionDTO(data);
  }

  async listSessions(playerId: string, limit: number): Promise<SessionDTO[]> {
    const { data, error } = await getServiceClient()
      .from("shift_sessions")
      .select("id, player_id, created_at, summary")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SessionRow[]>();
    if (error) fail("listSessions", error);
    return (data ?? []).map(toSessionDTO);
  }

  async getLeague(playerId: string, weekStart: Date, weekEnd: Date): Promise<LeagueDTO> {
    const { data, error } = await getServiceClient().rpc("weekly_league", {
      p_week_start: weekStart.toISOString(),
      p_week_end: weekEnd.toISOString(),
    });
    if (error) fail("getLeague", error);
    // 타입 생성(supabase gen types) 없이 쓰는 클라이언트라 rpc 결과를 직접 좁힌다
    const rows: LeagueRow[] = Array.isArray(data) ? (data as LeagueRow[]) : [];

    const entries: LeagueEntryDTO[] = rows.map((row, i) => ({
      playerId: row.player_id,
      name: row.name,
      // bigint 는 문자열로 올 수 있다
      weeklyWageDelta: Number(row.weekly_wage_delta),
      shifts: Number(row.shifts),
      wage: row.wage,
      rank: i + 1,
      isMe: row.player_id === playerId,
    }));

    return {
      weekStart: weekRangeFor(weekStart).label,
      entries,
      me: entries.find((e) => e.isMe) ?? null,
    };
  }
}
