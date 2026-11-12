-- ============================================================================
-- 0002: 심야(shinya) 시프트 허용
--   Lv4 심야 시프트와 승급 시험(점장 점검 시프트)이 추가되어 slot 값에 'shinya' 가 들어온다.
--   승급 시험 결과(summary.exam)와 돌발 이벤트 수(summary.events)는 summary(jsonb) 안에 있으므로
--   컬럼 추가는 없다. Supabase SQL Editor 에 그대로 붙여 넣어 실행한다.
-- ============================================================================
alter table public.shift_sessions
  drop constraint if exists shift_sessions_slot_check;

alter table public.shift_sessions
  add constraint shift_sessions_slot_check
  check (slot in ('asa', 'hiru', 'yoru', 'shinya'));

comment on column public.shift_sessions.slot is 'asa | hiru | yoru | shinya — 승급 시험도 시험 규칙의 시간대로 기록';
