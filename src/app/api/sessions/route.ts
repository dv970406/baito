/**
 * /api/sessions — 시프트 완료 기록.
 * 요청 쿠키/URL 을 읽으므로 Cache Components 에서 요청 시점 렌더링이 된다.
 * (`runtime` export 는 Cache Components 에서 지원되지 않아 두지 않는다.)
 */
import type { NextRequest } from "next/server";
import type { SessionDTO, SessionsListDTO } from "@/shared/api";
import { ApiError, jsonOk, withApi } from "@/server/http";
import { attachPlayerCookie, getOrCreatePlayerId } from "@/server/player";
import { getRepository } from "@/server/repository";
import { createSessionBodySchema, sessionsQuerySchema } from "@/server/schemas";

/** GET ?limit=1..50(기본 10) — 최신순 세션 목록 */
export const GET = withApi(async (req: NextRequest) => {
  const { playerId, isNew } = getOrCreatePlayerId(req);
  // 백엔드 미설정이면 쿠키 유무와 상관없이 503 이 되도록 먼저 저장소를 얻는다
  const repo = getRepository();
  const { limit } = sessionsQuerySchema.parse({
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  });
  // 방금 발급한 id 에는 세션이 있을 수 없다
  const sessions = isNew ? [] : await repo.listSessions(playerId, limit);

  const res = jsonOk<SessionsListDTO>({ sessions });
  return isNew ? attachPlayerCookie(res, playerId) : res;
});

/**
 * POST body = { summary: ShiftSummary } → 201 SessionDTO.
 * 프로필(players 행)이 없는 플레이어는 409 PROFILE_REQUIRED — 클라이언트는 먼저 PUT /api/profile 로
 * 프로필을 동기화해야 한다. (shift_sessions.player_id 가 players 를 참조하므로 행이 먼저 있어야 하고,
 * 서버가 임의의 기본 프로필을 만들면 클라이언트 로컬 상태와 어긋나기 때문에 만들지 않는다.)
 */
export const POST = withApi(async (req: NextRequest) => {
  const { playerId, isNew } = getOrCreatePlayerId(req);
  const repo = getRepository();
  const body = createSessionBodySchema.parse(await req.json());

  const profile = isNew ? null : await repo.getProfile(playerId);
  if (!profile) {
    throw new ApiError(
      "PROFILE_REQUIRED",
      "프로필이 없습니다. 먼저 PUT /api/profile 로 프로필을 저장하세요.",
      409,
    );
  }

  const session = await repo.createSession(playerId, body.summary);
  return jsonOk<SessionDTO>(session, { status: 201 });
});
