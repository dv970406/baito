/**
 * GET /api/league — 이번 주(JST 월요일 00:00 기준) 주간 리그 상위 30명 + 내 순위.
 * 요청 쿠키를 읽으므로 Cache Components 에서 요청 시점 렌더링이 된다.
 * (`runtime` export 는 Cache Components 에서 지원되지 않아 두지 않는다.)
 */
import type { NextRequest } from "next/server";
import type { LeagueDTO } from "@/shared/api";
import { jsonOk, withApi } from "@/server/http";
import { attachPlayerCookie, getOrCreatePlayerId } from "@/server/player";
import { getRepository } from "@/server/repository";
import { weekRangeFor } from "@/server/week";

export const GET = withApi(async (req: NextRequest) => {
  const { playerId, isNew } = getOrCreatePlayerId(req);
  const repo = getRepository();
  const { start, end } = weekRangeFor(new Date());
  const league = await repo.getLeague(playerId, start, end);

  const res = jsonOk<LeagueDTO>(league);
  return isNew ? attachPlayerCookie(res, playerId) : res;
});
