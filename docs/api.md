# BAITO 서버 API

BAITO 는 로컬 우선(local-first) 게임이다. 클라이언트는 상태를 `localStorage` 에 먼저 저장하고, 아래 API 로 서버(Supabase)와 동기화한다. 모든 API 는 Next.js Route Handler(`src/app/api/**/route.ts`) 로 구현되어 있고, 데이터 접근은 서버에서만 service_role 키로 이뤄진다.

## 엔드포인트

| 메서드 | 경로 | 요청 본문 / 쿼리 | 성공 응답 | 오류 |
| --- | --- | --- | --- | --- |
| `GET` | `/api/health` | – | `200` `HealthDTO` `{ ok, backend, time }` | `503 SUPABASE_NOT_CONFIGURED` |
| `GET` | `/api/profile` | – (쿠키) | `200` `ProfileDTO` `{ playerId, profile }` | `404 NOT_FOUND`, `503` |
| `PUT` | `/api/profile` | `PlayerProfile` (JSON) | `200` `ProfileDTO` — last-write-wins 적용 후 **최종** 프로필 | `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `503` |
| `GET` | `/api/sessions` | `?limit=1..50` (기본 10) | `200` `SessionsListDTO` `{ sessions }` — 최신순(`createdAt desc`) | `400 VALIDATION_ERROR`, `503` |
| `POST` | `/api/sessions` | `{ summary: ShiftSummary }` | `201` `SessionDTO` `{ id, playerId, createdAt, summary }` | `400 VALIDATION_ERROR`, `400 INVALID_JSON`, `409 PROFILE_REQUIRED`, `503` |
| `GET` | `/api/league` | – (쿠키) | `200` `LeagueDTO` `{ weekStart, entries[], me }` | `503` |

DTO 정의는 `src/shared/api.ts`, `src/shared/player.ts`, `src/engine/types.ts` 를 그대로 따른다. 모든 응답에는 `Cache-Control: no-store` 가 붙는다.

### 오류 응답 형태

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "요청 값이 올바르지 않습니다.", "details": { "formErrors": [], "fieldErrors": { "wage": ["..."] } } } }
```

| 코드 | 상태 | 뜻 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | zod 검증 실패. `details` 에 `z.flattenError` 결과 |
| `INVALID_JSON` | 400 | 본문이 JSON 이 아님 |
| `NOT_FOUND` | 404 | 저장된 프로필 없음 (`GET /api/profile`) |
| `PROFILE_REQUIRED` | 409 | 프로필 없이 세션 저장 시도 (`POST /api/sessions`) |
| `SUPABASE_NOT_CONFIGURED` | 503 | 프로덕션에서 Supabase 키 미설정 |
| `INTERNAL_ERROR` | 500 | 그 외. 스택은 서버 로그(`console.error`)에만 남고 클라이언트에는 노출되지 않는다 |

### 동작 세부

- **`PUT /api/profile` 은 last-write-wins.** 서버에 저장된 `profile.updatedAt` 이 요청의 것보다 새로우면 요청을 무시하고 저장된 프로필을 `200` 으로 돌려준다. 클라이언트는 응답 프로필을 로컬에 반영하면 된다. 같은 시각이면 요청이 이긴다.
- **`POST /api/sessions` 는 프로필이 먼저 있어야 한다.** `shift_sessions.player_id` 가 `players` 를 참조하고, 서버가 임의의 기본 프로필을 만들면 클라이언트 로컬 상태와 어긋나기 때문에 자동 생성하지 않는다. `409 PROFILE_REQUIRED` 를 받으면 `PUT /api/profile` 후 재시도한다.
- **`GET /api/league`** 는 현재 주(일본 시간 **월요일 00:00 ~ 다음 월요일 00:00**, `[start, end)`)의 `shift_sessions.played_at` 을 플레이어별로 합산해 `weeklyWageDelta` 내림차순 상위 30명을 돌려준다(동점: 시프트 수 → 현재 시급 → id). `weekStart` 는 그 월요일의 `YYYY-MM-DD`. `me` 는 호출자가 상위 30명 안에 있으면 그 항목(`isMe: true`), 아니면 `null`.
- `ShiftSummary.spokens`(말하기 모드로 맞힌 수)와 `AnswerLog.spoken` 은 말하기 모드 이전 저장분과의 호환을 위해 생략 시 각각 `0`, `false` 로 채워진다.
- 입력 스키마(`src/server/schemas.ts`)는 `.strict()` 라서 알 수 없는 필드가 있으면 400 이다. `name` 은 공백 제거 후 1~20자, `wage` 는 0~99999 정수, `answers` 는 최대 2000개.

## 인증 모델 — 익명 쿠키

로그인은 없다. 서버는 `baito_pid` 쿠키(uuid v4)로 플레이어를 식별한다.

- 쿠키가 없거나 형식이 틀리면 어떤 API 를 호출하든 서버가 새 uuid 를 만들어 응답에 `Set-Cookie` 로 내려준다(`404 NOT_FOUND` 응답에도 붙는다).
- 속성: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=31536000`(1년), 프로덕션(`NODE_ENV=production`)에서는 `Secure`.
- `HttpOnly` 라서 JS 로는 읽을 수 없다. 클라이언트는 응답 본문의 `playerId` 를 쓰면 된다.
- 쿠키를 지우면 새 플레이어가 된다(계정 복구 기능 없음). 브라우저 간 이어하기는 지원하지 않는다.
- DB 쪽 보호: 두 테이블에 RLS 가 켜져 있고 정책이 하나도 없으므로 anon 키로는 접근 불가. RLS 를 우회하는 service_role 키만 서버 라우트에서 쓴다.

## 데이터 백엔드 선택

`src/server/env.ts` 의 `resolveBackend()` 규칙:

1. `BAITO_DATA_BACKEND` 가 `supabase` 또는 `memory` 로 명시되면 그 값.
2. 아니면 `NEXT_PUBLIC_SUPABASE_URL` 과 `SUPABASE_SERVICE_ROLE_KEY` 가 **둘 다** 있으면 `supabase`.
3. 아니면 `NODE_ENV !== 'production'`(개발·테스트)이면 `memory`.
4. 아니면 `unconfigured` → 모든 데이터 API 와 `/api/health` 가 `503 SUPABASE_NOT_CONFIGURED`.

| 상황 | 결과 |
| --- | --- |
| `pnpm dev`, 키 없음 | `memory` — 프로세스 메모리(globalThis)에 저장, 재시작하면 사라짐, HMR 에는 유지 |
| `pnpm dev`, 키 있음 | `supabase` |
| 프로덕션, 키 있음 | `supabase` |
| 프로덕션, 키 없음 | `unconfigured` → 503 |
| 어떤 환경이든 `BAITO_DATA_BACKEND=memory` | `memory` (프로덕션에서는 권장하지 않음) |

`GET /api/health` 의 `backend` 필드로 현재 값을 확인할 수 있다. 빈 문자열(`KEY=`)은 미설정으로 취급한다.

## 환경변수

`.env.example` 을 `.env.local` 로 복사해 채운다.

| 변수 | 어디서 얻나 | 비고 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 대시보드 상단 **Connect** 버튼 → Project URL, 또는 **Settings → API Keys** 상단 (`https://<ref>.supabase.co`) | 공개돼도 되는 값 |
| `SUPABASE_SERVICE_ROLE_KEY` | **Settings → API Keys → Secret keys** 에서 `sb_secret_…` 키 생성·복사(권장). **Legacy API Keys** 탭의 `service_role`(`eyJ…`) 도 2026년 말까지 동작 | **서버 전용. RLS 를 우회한다.** 절대 `NEXT_PUBLIC_` 접두어를 붙이거나 클라이언트 코드에서 import 하지 않는다. Vercel 등 호스팅의 서버 환경변수로만 설정 |
| `BAITO_DATA_BACKEND` | 직접 지정 (`supabase` \| `memory`) | 비우면 위 규칙으로 자동 결정 |

`anon` 키는 이 프로젝트에서 쓰지 않는다(클라이언트가 Supabase 에 직접 붙지 않는다).

## 마이그레이션 적용

스키마는 `supabase/migrations/0001_init.sql` 하나다. 테이블 `players`, `shift_sessions`, 함수 `weekly_league(timestamptz, timestamptz)`, `players.updated_at` 트리거, RLS 설정이 들어 있다.

**방법 A — Supabase CLI**

```bash
# 최초 1회: 프로젝트 연결 (Project Settings → General → Reference ID)
supabase link --project-ref <project-ref>
# supabase/migrations/*.sql 을 원격 DB 에 적용
supabase db push
```

**방법 B — SQL Editor**

Supabase 대시보드 → **SQL Editor → New query** 에 `supabase/migrations/0001_init.sql` 내용을 붙여넣고 **Run**. 스크립트는 `if not exists` / `create or replace` 라 다시 실행해도 안전하다.

적용 후 확인: Table Editor 에 `players`, `shift_sessions` 가 보이고 두 테이블에 RLS 가 켜져 있어야 한다(정책 0개가 정상).

## 코드 구조

| 파일 | 역할 |
| --- | --- |
| `src/server/env.ts` | 환경변수 파싱(지연 평가), `resolveBackend()` |
| `src/server/supabase.ts` | `server-only` service_role 클라이언트(메모이즈) |
| `src/server/repository.ts` | `Repository` 인터페이스, `getRepository()`, `RepositoryUnavailableError` |
| `src/server/repository.supabase.ts` / `repository.memory.ts` | 구현체. 메모리 구현은 `resetMemoryRepository()` 로 초기화 |
| `src/server/lww.ts` | last-write-wins 판정 |
| `src/server/schemas.ts` | zod 스키마(공유 타입과 컴파일 타임 일치 단언) |
| `src/server/player.ts` | `baito_pid` 쿠키 읽기/발급 |
| `src/server/http.ts` | `jsonOk` / `jsonError` / `withApi`(예외 → 상태 코드) |
| `src/server/week.ts` | `weekRangeFor()` — JST 주간 범위 |
| `src/server/__tests__/` | vitest (메모리 백엔드로 라우트 핸들러 직접 호출) |

## Next.js 16 Cache Components 참고

`next.config.ts` 가 `cacheComponents: true` 이므로 Route Handler 도 다음을 따른다.

- `export const runtime = 'nodejs'` 를 **쓰지 않는다**. 공식 문서: "When Cache Components is enabled, remove the `runtime` export, including `runtime = 'nodejs'`." (`dynamic`, `revalidate` 세그먼트 설정도 제거됨)
- 쿠키·URL 을 읽는 핸들러(`/api/profile`, `/api/sessions`, `/api/league`)는 `request.cookies` / `request.nextUrl` 접근 자체가 프리렌더를 중단시키므로 추가 설정 없이 요청 시점에 실행된다.
- 요청 객체를 읽지 않는 `/api/health` 는 빌드 시 정적으로 굳어질 수 있어 `await connection()`(`next/server`)으로 실제 요청까지 렌더링을 미룬다.

## 로컬 검증

```bash
pnpm vitest run src/server   # 라우트·주간 범위·env 테스트
pnpm typecheck
pnpm lint src/server src/app/api
```
