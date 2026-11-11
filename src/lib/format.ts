/**
 * 표시용 포맷 함수 모음. 금액(¥)·일본어 날짜·시각.
 * 모든 날짜 함수는 로컬 시간 기준이다.
 */

/** U+2212 MINUS SIGN — 하이픈 대신 진짜 마이너스 기호를 쓴다 */
export const MINUS = "−";

/** 일본어 요일 (Date#getDay 순서) */
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 정수 부분에 천 단위 구분자를 넣는다. 로케일에 의존하지 않는다. */
function groupThousands(n: number): string {
  const abs = Math.abs(Math.trunc(n));
  return String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 1170 → "¥1,170" (음수는 "−¥25") */
export function formatYen(n: number): string {
  const body = `¥${groupThousands(n)}`;
  return n < 0 ? `${MINUS}${body}` : body;
}

/** 증감 표시. 40 → "+¥40", -25 → "−¥25", 0 → "±¥0" */
export function formatYenDelta(n: number): string {
  if (n > 0) return `+¥${groupThousands(n)}`;
  if (n < 0) return `${MINUS}¥${groupThousands(n)}`;
  return "±¥0";
}

/** 2026-11-10 → "11月10日（月）" */
export function formatDateJa(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_JA[date.getDay()]}）`;
}

/** 로컬 시간 기준 "YYYY-MM-DD" */
export function formatDateYmd(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 오늘 날짜(로컬) "YYYY-MM-DD" */
export function todayYmd(): string {
  return formatDateYmd(new Date());
}

/** 07:12 처럼 두 자리 시:분 */
export function formatTimeHm(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * 영수증 머리 날짜. "2026/11/10 昼シフト 11:30–14:00"
 * @param iso   플레이 시각 ISO 문자열 (ShiftSummary.playedAt)
 * @param kanji 시프트 한자 한 글자 (朝/昼/夕)
 * @param hours "11:30–14:00" 형태의 근무 시간
 */
export function formatReceiptDate(iso: string, kanji: string, hours: string): string {
  const d = new Date(iso);
  const ymd = Number.isNaN(d.getTime())
    ? iso.slice(0, 10).replace(/-/g, "/")
    : `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
  return `${ymd} ${kanji}シフト ${hours}`;
}
