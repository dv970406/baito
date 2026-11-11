/**
 * className 결합 유틸. 의존성 없이 falsy 값을 걸러내고 공백으로 이어 붙인다.
 * 객체 형태 `{ "클래스": 조건 }` 과 중첩 배열도 받는다.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string" || typeof input === "number") {
      out.push(String(input));
    } else if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) out.push(nested);
    } else {
      for (const key of Object.keys(input)) {
        if (input[key]) out.push(key);
      }
    }
  }
  return out.join(" ");
}
