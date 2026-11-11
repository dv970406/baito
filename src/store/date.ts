/** 로컬 시간대 기준 YYYY-MM-DD. 스트릭·오늘 시프트 판정은 전부 이 값으로 한다. */
export function localYmd(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM (유급휴가 월 단위 리셋용) */
export function localYm(date: Date = new Date()): string {
  return localYmd(date).slice(0, 7);
}
