/**
 * 익명 플레이어 식별 — 로그인 없이 httpOnly 쿠키 `baito_pid`(uuid v4) 로 플레이어를 구분한다.
 * next/headers 대신 NextRequest / NextResponse 를 직접 받아 단위 테스트가 가능하게 한다.
 */
import type { NextRequest, NextResponse } from "next/server";

export const PLAYER_COOKIE = "baito_pid";

/** 1년(초) */
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** uuid v4 형식인지 */
export function isValidPlayerId(value: string | undefined): value is string {
  return typeof value === "string" && UUID_V4_RE.test(value);
}

export interface PlayerIdentity {
  playerId: string;
  /** 이번 요청에서 새로 발급했으면 true → 응답에 쿠키를 붙여야 한다 */
  isNew: boolean;
}

/** 쿠키에서 플레이어 id 를 읽고, 없거나 형식이 틀리면 새로 발급한다 */
export function getOrCreatePlayerId(req: NextRequest): PlayerIdentity {
  const raw = req.cookies.get(PLAYER_COOKIE)?.value;
  if (isValidPlayerId(raw)) return { playerId: raw.toLowerCase(), isNew: false };
  return { playerId: crypto.randomUUID(), isNew: true };
}

/** 응답에 플레이어 쿠키를 붙인다 (httpOnly · lax · 1년 · 프로덕션에서는 secure) */
export function attachPlayerCookie<T extends NextResponse>(res: T, playerId: string): T {
  res.cookies.set({
    name: PLAYER_COOKIE,
    value: playerId,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SEC,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
