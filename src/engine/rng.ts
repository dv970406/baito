/**
 * 결정적 난수 생성기 (mulberry32).
 * 엔진의 모든 무작위성은 이 모듈을 통해서만 발생한다 — Math.random() 금지.
 * 같은 seed 는 항상 같은 수열을 만든다(테스트·리플레이·서버 검증용).
 */

export interface Rng {
  /** [0, 1) 구간의 실수 */
  next(): number;
  /** [min, max] 양끝 포함 정수 */
  int(min: number, max: number): number;
  /** 배열에서 하나를 고른다. 빈 배열이면 예외 */
  pick<T>(arr: readonly T[]): T;
  /** 원본을 건드리지 않는 Fisher-Yates 셔플 */
  shuffle<T>(arr: readonly T[]): T[];
  /** 확률 p(0~1)로 true */
  chance(p: number): boolean;
}

/** mulberry32 — 32비트 상태 하나로 동작하는 작고 빠른 PRNG */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      if (hi < lo) return lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(arr) {
      if (arr.length === 0) {
        throw new Error("Rng.pick: 빈 배열에서 고를 수 없다");
      }
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    chance(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return next() < p;
    },
  };
}

/**
 * 여러 값(문자열·숫자)을 하나의 32비트 시드로 섞는다 (FNV-1a 변형).
 * createRng(hashSeed(seed, customerIndex, stepIndex)) 처럼 상태로부터 시드를 파생할 때 쓴다.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const str = typeof part === "number" ? `n:${part}` : `s:${part}`;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // 파트 경계 구분자
    h ^= 0x7c;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
