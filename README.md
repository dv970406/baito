# BAITO — 일본 알바 리듬 시뮬

> 일본어 학습 앱처럼 보이지 않는, 일본 아르바이트 리듬 시뮬레이션 웹게임.
> 첫 직장은 편의점 **KONBINI**(マルマート 神田南口店). 손님이 오면 POS 버튼으로 알맞은 한마디를 고르고, 속도와 정확도에 따라 시급이 오르내립니다.

플레이어에게 보이는 지표는 **시급 · 콤보 · 단골 · 직장 이력**만입니다. 진도율·레벨·"공부" 같은 학습 UI 는 의도적으로 없습니다.

## 기술 스택

| 구분 | 내용 |
| --- | --- |
| 프레임워크 | Next.js 16.4.5 (App Router, Cache Components, Turbopack) |
| UI | React 19.3, Tailwind CSS 4 (`src/app/theme.css` 디자인 토큰) |
| 상태 | Zustand 5 (`localStorage` 로컬 우선 세이브 + 서버 동기화) |
| 서버 | Next.js Route Handler (`src/app/api/**`) + Supabase (service_role, 서버 전용) |
| 검증 | zod 4 |
| 테스트 | Vitest 5, Testing Library (jsdom) |
| 패키지 매니저 | pnpm |

## 시작하기

```bash
pnpm install
cp .env.example .env.local   # Supabase 키가 없어도 개발 모드에서는 메모리 백엔드로 동작
pnpm dev                     # http://localhost:3000
```

| 스크립트 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` / `pnpm start` | 프로덕션 빌드 / 실행 |
| `pnpm test` | Vitest 전체 실행 (`pnpm test:watch` 는 감시 모드) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

### 환경 변수

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키. **서버 모듈에서만** 읽히며 클라이언트 번들에 포함되지 않습니다 |
| `BAITO_DATA_BACKEND` | `supabase` \| `memory` 강제 지정(선택). 비우면 키가 있으면 supabase, 없으면 개발에서는 memory, 프로덕션에서는 503 |

Supabase 스키마는 `supabase/migrations/0001_init.sql` 을 SQL Editor 에 붙여 넣거나 `supabase db push` 로 적용합니다. 자세한 API 명세와 설정 절차는 [`docs/api.md`](docs/api.md) 를 참고하세요.

## 화면

| 경로 | 화면 |
| --- | --- |
| `/` | 이력서 · 직장 선택 (KONBINI 열림, HOTERU·SHOKUDO 잠김, KUKO 출장) |
| `/konbini` | 홈 · 오늘의 시프트 표(朝·昼·夕 + 추가 근무 深夜) · 점장 메모 · 이번 달 공지 · 승급 시험 카드 |
| `/konbini/shift/[slot]` | 인게임 — 손님 응대 POS 화면 (`asa` \| `hiru` \| `yoru` \| `shinya`) |
| `/konbini/shift/shinya` | 심야 시프트 — 朝·昼·夕 를 다 끝낸 선배부터. 취객·돌발 손님·오뎅·튀김 |
| `/konbini/shift/exam` | 승급 시험(店長点検 · 점장 점검 시프트) — 주 1회, 다음 직급의 시험 규칙으로 시프트를 연다 |
| `/konbini/receipt` | 마감 영수증 · 텍스트 공유 · 이미지 저장 · 「この一瞬」 공유 카드 · 지난 영수증 |
| `/konbini/regulars` | 단골 도감 · 호감도 · 처음 들은 말(길게 누르면 뜻·단어 분해) |
| `/konbini/league` | 이번 주 시급 랭킹 · 하위권이면 점장 코칭 한 줄 |

## 디렉터리 구조

```
src/
├── app/            # 라우트(서버 컴포넌트 셸) + API Route Handler + 전역 CSS/테마
├── components/
│   ├── ui/         # 디자인 시스템 컴포넌트 키트 (Screen, PosButton, Avatar …)
│   ├── game/       # 인게임 화면 + useShift(엔진 ↔ React 연결)
│   └── screens/    # 이력서·홈·영수증·도감·리그 화면
├── engine/         # 순수 함수 게임 엔진 (시드 RNG, 손님 생성, 시프트 리듀서, 채점, 진급)
├── content/        # 직장별 데이터 폴더 (konbini: 상품·문구·단골·점장 대사·시프트)
├── store/          # Zustand 세이브 스토어, 서버 동기화, 선택자
├── server/         # Repository 추상화(Supabase/Memory), zod 스키마, 쿠키 식별, 에러 처리
├── shared/         # 클라이언트·서버 공용 타입 (PlayerProfile, DTO)
└── lib/            # 포맷·오디오(Web Audio + Web Speech)·공유·cn
supabase/migrations # DB 스키마
docs/               # API 문서
```

## 승급 시험 · 시즌 · 돌발 이벤트 · PWA

- **승급 시험(店長点検).** 직급별 `shiftsRequired` 를 채우면 홈에 「店長点検」 카드가 열리고 `/konbini/shift/exam` 으로 들어간다. 다음 직급의 `exam` 규칙(시간대 + 기준 콤보)으로 시프트를 돌려 **최고 콤보가 기준 이상이고 이탈 0** 이면 합격 → `profile.rank` 가 오른다. 주 1회(`profile.examWeek` = 그 주 월요일), 시험은 오늘 시프트 표의 칸을 채우지 않는다. 결과는 영수증 상단 「店長点検 · 合格/不合格」 블록에 남는다.
- **심야 시프트(深夜).** 朝·昼·夕 를 다 끝낸 날, 선배(`requiredRank: senpai`) 이상이면 네 번째 행이 열린다. フルシフト 집계에는 들어가지 않는 추가 근무다.
- **시즌.** `src/content/konbini/extras.ts` 의 `konbiniSeasons` 가 달(1~12)별 한정 상품·한정 단골·규칙 변경(`rule`)을 정의한다. 이번 달 항목에 `noticeJa` 가 있으면 홈 점장 메모 아래 「今月のお知らせ」 카드로 보인다. 시즌 한정 단골은 도감에 「N월 한정」 배지로 표시된다.
- **돌발 이벤트.** Lv3 부터 물건 없이 찾아오는 손님(길 묻기·택배·화장실 …)이 섞인다. 처리한 수는 `ShiftSummary.events` 로 남아 영수증에 「突発対応 N件」 으로 찍힌다.
- **PWA.** `src/app/manifest.ts`(standalone, `start_url: /konbini`) + `public/sw.js`(앱 셸 캐시 · 네트워크 우선 · `/api/` 는 캐시 금지) + `src/app/RegisterSw.tsx`(프로덕션에서만 등록, 개발 모드에서는 기존 등록 해제). 아이콘은 `public/icons/icon.svg` 와 `src/app/icon.tsx`·`apple-icon.tsx`(`next/og` ImageResponse) 가 빌드 시 PNG(`/icon/192`, `/icon/512`, `/icon/maskable`, `/apple-icon`) 로 만든다 — 별도 이미지 라이브러리 없음.

## 말하기 모드

레지의 **話す · 말하기** 버튼을 누르면 Web Speech API(ja-JP)로 한마디를 듣고, 선택지와 너그럽게 맞춥니다(핵심 형태소 위주의 바이그램 유사도). 듣는 동안 질문 타이머는 멈추고, 인식에 실패해도 벌점 없이 버튼으로 이어서 답할 수 있습니다. 말로 맞힌 응대는 시급이 더 오릅니다(1회당 +¥3). 해금은 **선배 직급부터 전 시프트**, 그 전에도 **夕(레벨 3) 시프트**에서는 열립니다. 음성 인식을 지원하지 않는 브라우저에서는 버튼이 보이지 않습니다.

## 배포 (Vercel)

1. **프로젝트 연결** — Vercel 대시보드에서 저장소를 Import 한다. `vercel.json` 이 프레임워크(`nextjs`)·리전(`icn1`, 서울)·헤더(`/sw.js` 는 `no-cache`, `/api/*` 는 `no-store`)를 지정하므로 추가 설정은 없다.
2. **환경변수 3개** — Project → Settings → Environment Variables 에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, (선택) `BAITO_DATA_BACKEND` 를 넣는다. `SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용이므로 Production/Preview 모두에 넣되 절대 `NEXT_PUBLIC_` 접두어를 붙이지 않는다. 값은 `.env.example` 설명을 따른다.
3. **마이그레이션 순서** — Supabase SQL Editor(또는 `supabase db push`)에서 **`supabase/migrations/0001_init.sql` → `0002_shinya_slot.sql`** 순으로 적용한다. 0002 는 `shift_sessions.slot` 제약에 `shinya` 를 추가하므로 0001 뒤에 돌려야 한다.
4. **배포 후 확인** — `https://<도메인>/api/health` 가 `{ "ok": true, "backend": "supabase" }` 를 돌려주면 서버 연결 완료. `/manifest.webmanifest` 와 `/sw.js` 가 200 이면 PWA 설치가 가능하다(홈 화면 추가 → standalone 으로 열림).

## 설계 메모

- **엔진은 순수 함수**입니다. `shiftReducer(state, event, content)` 가 `START / TICK / ANSWER / SKIP_PHASE` 이벤트만 받고, 난수는 `seed` 에서 용도별로 파생하므로 같은 시드·같은 답이면 같은 손님·선택지가 재현됩니다.
- **로컬 우선 세이브.** 진행 상황은 `localStorage` 에 먼저 저장되고, 익명 쿠키(`baito_pid`)로 식별되는 서버 프로필과 `updatedAt` 기준 last-write-wins 로 병합됩니다. 전송에 실패한 시프트 결과는 큐에 남아 재시도됩니다.
- **직장 추가는 데이터 폴더 추가**로 끝나도록 `WorkplaceContent` 계약을 두었습니다(`src/content/<workplace>/`).
- 디자인은 토큰(`theme.css`)만 사용합니다. 그림자 대신 헤어라인, 그라데이션·이모지 없음, 일본어 우선 + 한국어 캡션, 44px 터치 타깃.
