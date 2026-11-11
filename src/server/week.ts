/**
 * 주간 리그 기간 계산 — 순수 함수.
 * 기준: Asia/Tokyo(UTC+9) 의 월요일 00:00 부터 다음 월요일 00:00 직전까지 [start, end).
 * (일본은 서머타임이 없어 고정 오프셋 +9h 로 충분하다.)
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TOKYO_OFFSET_MS = 9 * HOUR_MS;

export interface WeekRange {
  /** 월요일 00:00 JST 에 해당하는 UTC 시각 */
  start: Date;
  /** 다음 월요일 00:00 JST (배타) */
  end: Date;
  /** 월요일 날짜 YYYY-MM-DD (JST 기준) — LeagueDTO.weekStart 에 그대로 쓴다 */
  label: string;
}

/** Date 를 YYYY-MM-DD(UTC 필드 기준)로 */
function isoDateUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 주어진 시각이 속한 JST 주(월~일)의 범위를 돌려준다.
 * 구현: 시각을 +9h 이동해 "JST 벽시계를 UTC 필드로" 읽고, 월요일 00:00 으로 내린 뒤 다시 -9h.
 */
export function weekRangeFor(date: Date): WeekRange {
  const shifted = new Date(date.getTime() + TOKYO_OFFSET_MS);
  // getUTCDay: 0=일 … 6=토 → 월요일부터 며칠 지났는지
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  const mondayShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceMonday,
  );
  const start = new Date(mondayShifted - TOKYO_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { start, end, label: isoDateUTC(new Date(mondayShifted)) };
}
