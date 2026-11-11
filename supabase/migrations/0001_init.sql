-- ============================================================================
-- BAITO 초기 스키마
-- 적용: `supabase db push` 또는 Supabase 대시보드 SQL Editor 에 붙여넣기
-- ============================================================================

-- gen_random_uuid() 는 Postgres 13+ 내장. (Supabase 는 pgcrypto 도 기본 제공)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- players: 익명 플레이어 1명 = 1행. id 는 클라이언트 쿠키(baito_pid)의 uuid.
--   profile(jsonb) 이 정본(PlayerProfile 전체)이고, name/wage/total_shifts 는
--   리그 집계용으로 profile 의 값을 미러링한 컬럼이다.
-- ----------------------------------------------------------------------------
create table if not exists public.players (
  id            uuid primary key,
  name          text        not null default '알바생',
  wage          int         not null default 1000,
  total_shifts  int         not null default 0,
  profile       jsonb       not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.players              is '익명 플레이어. id = baito_pid 쿠키의 uuid';
comment on column public.players.profile      is 'PlayerProfile 전체(JSON). last-write-wins 는 profile.updatedAt 기준';
comment on column public.players.name         is 'profile.name 미러(리그 표시용)';
comment on column public.players.wage         is 'profile.wage 미러(현재 시급 ¥)';
comment on column public.players.total_shifts is 'profile.totalShifts 미러(누적 완료 시프트)';

-- ----------------------------------------------------------------------------
-- shift_sessions: 시프트 1회 완료 기록. summary(jsonb) 가 ShiftSummary 원본,
--   나머지 컬럼은 집계/정렬을 위해 summary 에서 뽑아낸 값이다.
-- ----------------------------------------------------------------------------
create table if not exists public.shift_sessions (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid        not null references public.players(id) on delete cascade,
  workplace_id  text        not null,
  slot          text        not null check (slot in ('asa', 'hiru', 'yoru')),
  level         int         not null,
  played_at     timestamptz not null,
  wage_delta    int         not null,
  served        int         not null,
  missed        int         not null,
  max_combo     int         not null,
  summary       jsonb       not null,
  created_at    timestamptz default now()
);

comment on table  public.shift_sessions            is '시프트 완료 기록(마감 영수증 원본)';
comment on column public.shift_sessions.summary    is 'ShiftSummary 전체(JSON)';
comment on column public.shift_sessions.played_at  is 'summary.playedAt — 주간 리그 집계 기준 시각';
comment on column public.shift_sessions.wage_delta is 'summary.wageDelta — 이 시프트로 변한 시급(¥)';

-- 플레이어별 최신순 조회(GET /api/sessions) 와 주간 리그 범위 스캔용 인덱스
create index if not exists shift_sessions_player_created_idx
  on public.shift_sessions (player_id, created_at desc);
create index if not exists shift_sessions_played_at_idx
  on public.shift_sessions (played_at desc);

-- ----------------------------------------------------------------------------
-- RLS: 두 테이블 모두 RLS 를 켜고 정책을 하나도 만들지 않는다.
--   → anon / authenticated 키로는 어떤 행도 읽거나 쓸 수 없다.
--   → RLS 를 우회하는 service_role 키(서버의 API Route 전용)만 접근 가능.
--   플레이어 식별이 Supabase Auth 가 아닌 서버 쿠키(baito_pid)로 이뤄지므로,
--   모든 접근 제어는 Next.js Route Handler 가 책임진다.
-- ----------------------------------------------------------------------------
alter table public.players        enable row level security;
alter table public.shift_sessions enable row level security;

-- ----------------------------------------------------------------------------
-- players.updated_at 자동 갱신 트리거
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- weekly_league: [p_week_start, p_week_end) 구간의 shift_sessions 를
--   플레이어별로 합산해 주간 시급 변동 합계 내림차순 상위 30명을 돌려준다.
--   동점이면 시프트 수 많은 쪽 → 현재 시급 높은 쪽 → player_id 순으로 안정 정렬.
--   security definer 가 아니므로 service_role 로만 호출된다(RLS 정책 없음).
-- ----------------------------------------------------------------------------
create or replace function public.weekly_league(
  p_week_start timestamptz,
  p_week_end   timestamptz
)
returns table (
  player_id         uuid,
  name              text,
  wage              int,
  weekly_wage_delta bigint,
  shifts            bigint
)
language sql
stable
as $$
  select
    p.id                          as player_id,
    p.name                        as name,
    p.wage                        as wage,
    sum(s.wage_delta)::bigint     as weekly_wage_delta,
    count(*)::bigint              as shifts
  from public.shift_sessions s
  join public.players p on p.id = s.player_id
  where s.played_at >= p_week_start
    and s.played_at <  p_week_end
  group by p.id, p.name, p.wage
  order by weekly_wage_delta desc, shifts desc, p.wage desc, p.id
  limit 30;
$$;

comment on function public.weekly_league(timestamptz, timestamptz)
  is '주간 리그 상위 30명. 구간은 [start, end), 기준 컬럼은 shift_sessions.played_at';
