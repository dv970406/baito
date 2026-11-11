/**
 * /api/profile — 플레이어 프로필 조회/저장.
 * 요청 쿠키(request.cookies)를 읽으므로 Cache Components 에서 자동으로 요청 시점 렌더링이 된다.
 * (`runtime` export 는 Cache Components 에서 지원되지 않아 두지 않는다.)
 */
import type { NextRequest } from "next/server";
import type { ProfileDTO } from "@/shared/api";
import { jsonError, jsonOk, withApi } from "@/server/http";
import { attachPlayerCookie, getOrCreatePlayerId } from "@/server/player";
import { getRepository } from "@/server/repository";
import { playerProfileSchema } from "@/server/schemas";

/** GET — 저장된 프로필. 없으면 404 NOT_FOUND (쿠키는 그래도 발급한다) */
export const GET = withApi(async (req: NextRequest) => {
  const { playerId, isNew } = getOrCreatePlayerId(req);
  const repo = getRepository();
  // 방금 발급한 id 에는 프로필이 있을 수 없다
  const profile = isNew ? null : await repo.getProfile(playerId);

  const res = profile
    ? jsonOk<ProfileDTO>({ playerId, profile })
    : jsonError("NOT_FOUND", "저장된 프로필이 없습니다.", 404);
  return isNew ? attachPlayerCookie(res, playerId) : res;
});

/** PUT — body = PlayerProfile. last-write-wins 로 저장하고 최종 프로필을 돌려준다 */
export const PUT = withApi(async (req: NextRequest) => {
  const { playerId, isNew } = getOrCreatePlayerId(req);
  const repo = getRepository();
  const incoming = playerProfileSchema.parse(await req.json());
  const profile = await repo.upsertProfile(playerId, incoming);

  const res = jsonOk<ProfileDTO>({ playerId, profile });
  return isNew ? attachPlayerCookie(res, playerId) : res;
});
