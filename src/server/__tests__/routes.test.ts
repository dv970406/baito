/**
 * Route Handler 통합 테스트 — MemoryRepository 위에서 실제 핸들러 함수를 호출한다.
 * `server-only` 는 Next 번들러 밖(vitest)에서는 해석되지 않으므로 빈 모듈로 대체한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ApiErrorBody,
  HealthDTO,
  LeagueDTO,
  ProfileDTO,
  SessionDTO,
  SessionsListDTO,
} from "@/shared/api";
import type { PlayerProfile } from "@/shared/player";
import { resetMemoryRepository } from "../repository.memory";
import { GET as healthGet } from "@/app/api/health/route";
import { GET as profileGet, PUT as profilePut } from "@/app/api/profile/route";
import { GET as sessionsGet, POST as sessionsPost } from "@/app/api/sessions/route";
import { GET as leagueGet } from "@/app/api/league/route";
import { extractPidCookie, makeProfile, makeRequest, makeSummary, readJson } from "./fixtures";

vi.mock("server-only", () => ({}));

/**
 * `connection()` 은 Next 요청 스코프(work store) 밖에서 호출하면 던진다.
 * 테스트에서는 즉시 resolve 하는 no-op 으로 바꾼다 (NextRequest/NextResponse 등 나머지는 원본 유지).
 */
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, connection: async () => undefined };
});

/** 프로필을 PUT 해서 새 플레이어(쿠키) 를 만든다 */
async function createPlayer(profile: PlayerProfile = makeProfile()): Promise<{ cookie: string; playerId: string }> {
  const res = await profilePut(makeRequest("/api/profile", { method: "PUT", body: profile }));
  expect(res.status).toBe(200);
  const cookie = extractPidCookie(res);
  expect(cookie).not.toBeNull();
  const dto = await readJson<ProfileDTO>(res);
  return { cookie: cookie as string, playerId: dto.playerId };
}

beforeEach(() => {
  process.env.BAITO_DATA_BACKEND = "memory";
  resetMemoryRepository();
});

afterEach(() => {
  delete process.env.BAITO_DATA_BACKEND;
  vi.unstubAllEnvs();
});

describe("GET /api/health", () => {
  it("200 + HealthDTO 형태, no-store", async () => {
    const res = await healthGet(makeRequest("/api/health"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await readJson<HealthDTO>(res);
    expect(body.ok).toBe(true);
    expect(body.backend).toBe("memory");
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it("백엔드 미설정(프로덕션) 이면 503 SUPABASE_NOT_CONFIGURED", async () => {
    delete process.env.BAITO_DATA_BACKEND;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.stubEnv("NODE_ENV", "production");
    const res = await healthGet(makeRequest("/api/health"));
    expect(res.status).toBe(503);
    const body = await readJson<ApiErrorBody>(res);
    expect(body.error.code).toBe("SUPABASE_NOT_CONFIGURED");
  });
});

describe("/api/profile", () => {
  it("쿠키 없는 GET 은 404 NOT_FOUND 지만 쿠키는 발급한다", async () => {
    const res = await profileGet(makeRequest("/api/profile"));
    expect(res.status).toBe(404);
    const body = await readJson<ApiErrorBody>(res);
    expect(body.error.code).toBe("NOT_FOUND");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/baito_pid=[0-9a-f-]{36}/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=31536000/);
    // 개발/테스트에서는 secure 가 아니다
    expect(setCookie).not.toMatch(/Secure/i);
  });

  it("404 → PUT 200(쿠키 발급) → 같은 쿠키로 GET 200", async () => {
    const first = await profileGet(makeRequest("/api/profile"));
    expect(first.status).toBe(404);

    const profile = makeProfile();
    const put = await profilePut(makeRequest("/api/profile", { method: "PUT", body: profile }));
    expect(put.status).toBe(200);
    const cookie = extractPidCookie(put);
    expect(cookie).not.toBeNull();
    const putBody = await readJson<ProfileDTO>(put);
    expect(putBody.profile).toEqual(profile);
    expect(cookie).toBe(`baito_pid=${putBody.playerId}`);

    const get = await profileGet(makeRequest("/api/profile", { cookie: cookie as string }));
    expect(get.status).toBe(200);
    // 이미 쿠키가 있으면 다시 발급하지 않는다
    expect(get.headers.get("set-cookie")).toBeNull();
    const getBody = await readJson<ProfileDTO>(get);
    expect(getBody.playerId).toBe(putBody.playerId);
    expect(getBody.profile).toEqual(profile);
  });

  it("형식이 틀린 쿠키는 무시하고 새 id 를 발급한다", async () => {
    const res = await profileGet(makeRequest("/api/profile", { cookie: "baito_pid=not-a-uuid" }));
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toMatch(/baito_pid=[0-9a-f-]{36}/);
  });

  it("PUT 잘못된 본문 → 400 VALIDATION_ERROR (issues 포함)", async () => {
    const bad = { ...makeProfile(), wage: -5, name: "" };
    const res = await profilePut(makeRequest("/api/profile", { method: "PUT", body: bad }));
    expect(res.status).toBe(400);
    const body = await readJson<ApiErrorBody>(res);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const details = body.error.details as { fieldErrors: Record<string, string[]> };
    expect(Object.keys(details.fieldErrors)).toEqual(expect.arrayContaining(["wage", "name"]));
  });

  it("PUT 에 알 수 없는 필드가 있으면 400 (strict)", async () => {
    const res = await profilePut(
      makeRequest("/api/profile", { method: "PUT", body: { ...makeProfile(), hacked: true } }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT 본문이 JSON 이 아니면 400 INVALID_JSON", async () => {
    const res = await profilePut(makeRequest("/api/profile", { method: "PUT", body: "{nope" }));
    expect(res.status).toBe(400);
    const body = await readJson<ApiErrorBody>(res);
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("last-write-wins: 더 오래된 updatedAt 은 무시되고 저장된 값이 돌아온다", async () => {
    const newer = makeProfile({ name: "새것", updatedAt: "2026-11-09T10:00:00.000Z" });
    const { cookie } = await createPlayer(newer);

    const older = makeProfile({ name: "옛것", updatedAt: "2026-11-09T09:00:00.000Z" });
    const res = await profilePut(makeRequest("/api/profile", { method: "PUT", body: older, cookie }));
    expect(res.status).toBe(200);
    const body = await readJson<ProfileDTO>(res);
    expect(body.profile.name).toBe("새것");

    const get = await profileGet(makeRequest("/api/profile", { cookie }));
    expect((await readJson<ProfileDTO>(get)).profile.name).toBe("새것");

    // 더 새로운 값은 덮어쓴다
    const newest = makeProfile({ name: "최신", updatedAt: "2026-11-09T11:00:00.000Z" });
    const res2 = await profilePut(makeRequest("/api/profile", { method: "PUT", body: newest, cookie }));
    expect((await readJson<ProfileDTO>(res2)).profile.name).toBe("최신");
  });
});

describe("/api/sessions", () => {
  it("프로필 없이 POST → 409 PROFILE_REQUIRED", async () => {
    const res = await sessionsPost(
      makeRequest("/api/sessions", { method: "POST", body: { summary: makeSummary() } }),
    );
    expect(res.status).toBe(409);
    const body = await readJson<ApiErrorBody>(res);
    expect(body.error.code).toBe("PROFILE_REQUIRED");
  });

  it("프로필이 있으면 POST → 201 SessionDTO", async () => {
    const { cookie, playerId } = await createPlayer();
    const summary = makeSummary();
    const res = await sessionsPost(
      makeRequest("/api/sessions", { method: "POST", body: { summary }, cookie }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<SessionDTO>(res);
    expect(body.playerId).toBe(playerId);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.summary).toEqual(summary);
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
  });

  it("POST 잘못된 summary → 400 VALIDATION_ERROR", async () => {
    const { cookie } = await createPlayer();
    const res = await sessionsPost(
      makeRequest("/api/sessions", {
        method: "POST",
        body: { summary: { ...makeSummary(), slot: "night" } },
        cookie,
      }),
    );
    expect(res.status).toBe(400);
    expect((await readJson<ApiErrorBody>(res)).error.code).toBe("VALIDATION_ERROR");
  });

  it("GET 은 최신순이고 limit 을 지킨다 (기본 10)", async () => {
    const { cookie } = await createPlayer();
    for (let i = 0; i < 12; i++) {
      const res = await sessionsPost(
        makeRequest("/api/sessions", {
          method: "POST",
          body: { summary: makeSummary({ wageDelta: i }) },
          cookie,
        }),
      );
      expect(res.status).toBe(201);
    }

    const def = await sessionsGet(makeRequest("/api/sessions", { cookie }));
    expect(def.status).toBe(200);
    const defBody = await readJson<SessionsListDTO>(def);
    expect(defBody.sessions).toHaveLength(10);
    // 마지막에 넣은 wageDelta=11 이 맨 앞
    expect(defBody.sessions[0]?.summary.wageDelta).toBe(11);
    const deltas = defBody.sessions.map((s) => s.summary.wageDelta);
    expect(deltas).toEqual([...deltas].sort((a, b) => b - a));

    const limited = await sessionsGet(makeRequest("/api/sessions", { cookie, query: { limit: "3" } }));
    expect((await readJson<SessionsListDTO>(limited)).sessions).toHaveLength(3);

    const max = await sessionsGet(makeRequest("/api/sessions", { cookie, query: { limit: "50" } }));
    expect((await readJson<SessionsListDTO>(max)).sessions).toHaveLength(12);
  });

  it("다른 플레이어의 세션은 보이지 않는다", async () => {
    const a = await createPlayer();
    const b = await createPlayer(makeProfile({ name: "B" }));
    await sessionsPost(
      makeRequest("/api/sessions", { method: "POST", body: { summary: makeSummary() }, cookie: a.cookie }),
    );
    const res = await sessionsGet(makeRequest("/api/sessions", { cookie: b.cookie }));
    expect((await readJson<SessionsListDTO>(res)).sessions).toHaveLength(0);
  });

  it("쿠키 없는 GET 은 빈 목록 + 쿠키 발급", async () => {
    const res = await sessionsGet(makeRequest("/api/sessions"));
    expect(res.status).toBe(200);
    expect((await readJson<SessionsListDTO>(res)).sessions).toEqual([]);
    expect(res.headers.get("set-cookie")).toMatch(/baito_pid=/);
  });

  it.each(["0", "51", "abc", "1.5"])("limit=%s → 400 VALIDATION_ERROR", async (limit) => {
    const { cookie } = await createPlayer();
    const res = await sessionsGet(makeRequest("/api/sessions", { cookie, query: { limit } }));
    expect(res.status).toBe(400);
    expect((await readJson<ApiErrorBody>(res)).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/league", () => {
  it("이번 주 세션을 합산해 순위를 매기고 me 를 표시한다", async () => {
    const me = await createPlayer(makeProfile({ name: "나", wage: 1100 }));
    const rival = await createPlayer(makeProfile({ name: "라이벌", wage: 1200 }));
    const idle = await createPlayer(makeProfile({ name: "휴식중" }));

    const post = (cookie: string, wageDelta: number) =>
      sessionsPost(
        makeRequest("/api/sessions", { method: "POST", body: { summary: makeSummary({ wageDelta }) }, cookie }),
      );
    await post(me.cookie, 20);
    await post(me.cookie, 15);
    await post(rival.cookie, 50);
    // 지난주 세션은 집계되지 않는다
    await sessionsPost(
      makeRequest("/api/sessions", {
        method: "POST",
        body: {
          summary: makeSummary({
            wageDelta: 999,
            playedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        },
        cookie: idle.cookie,
      }),
    );

    const res = await leagueGet(makeRequest("/api/league", { cookie: me.cookie }));
    expect(res.status).toBe(200);
    const body = await readJson<LeagueDTO>(res);

    expect(body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0]).toMatchObject({
      playerId: rival.playerId,
      name: "라이벌",
      weeklyWageDelta: 50,
      shifts: 1,
      wage: 1200,
      rank: 1,
      isMe: false,
    });
    expect(body.entries[1]).toMatchObject({
      playerId: me.playerId,
      name: "나",
      weeklyWageDelta: 35,
      shifts: 2,
      wage: 1100,
      rank: 2,
      isMe: true,
    });
    expect(body.me).toEqual(body.entries[1]);
  });

  it("세션이 없는 플레이어는 me = null", async () => {
    const { cookie } = await createPlayer();
    const res = await leagueGet(makeRequest("/api/league", { cookie }));
    const body = await readJson<LeagueDTO>(res);
    expect(body.me).toBeNull();
    expect(body.entries).toEqual([]);
  });

  it("쿠키 없는 GET 도 200 + 쿠키 발급", async () => {
    const res = await leagueGet(makeRequest("/api/league"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/baito_pid=/);
  });
});

describe("백엔드 미설정(프로덕션)", () => {
  beforeEach(() => {
    delete process.env.BAITO_DATA_BACKEND;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.stubEnv("NODE_ENV", "production");
  });

  it("데이터를 쓰는 라우트는 모두 503 SUPABASE_NOT_CONFIGURED", async () => {
    const results = await Promise.all([
      profileGet(makeRequest("/api/profile")),
      profilePut(makeRequest("/api/profile", { method: "PUT", body: makeProfile() })),
      sessionsGet(makeRequest("/api/sessions")),
      sessionsPost(makeRequest("/api/sessions", { method: "POST", body: { summary: makeSummary() } })),
      leagueGet(makeRequest("/api/league")),
    ]);
    for (const res of results) {
      expect(res.status).toBe(503);
      expect((await readJson<ApiErrorBody>(res)).error.code).toBe("SUPABASE_NOT_CONFIGURED");
    }
  });
});
