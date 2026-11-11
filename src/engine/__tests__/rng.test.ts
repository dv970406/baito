import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "../rng";

describe("createRng", () => {
  it("같은 seed 는 같은 수열을 만든다", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("다른 seed 는 다른 수열을 만든다", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next 는 [0,1) 구간", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int 는 양끝을 포함한 정수를 돌려준다", () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.int(2, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([2, 3, 4, 5]));
  });

  it("int 는 min===max 이면 그 값", () => {
    expect(createRng(1).int(3, 3)).toBe(3);
  });

  it("shuffle 은 원본을 바꾸지 않고 같은 원소를 가진 순열을 만든다", () => {
    const rng = createRng(11);
    const src = [1, 2, 3, 4, 5, 6];
    const out = rng.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.slice().sort()).toEqual(src);
  });

  it("pick 은 빈 배열에서 예외", () => {
    expect(() => createRng(1).pick([])).toThrow();
  });

  it("chance 의 경계값", () => {
    const rng = createRng(5);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (rng.chance(0.3)) hits++;
    expect(hits / 2000).toBeGreaterThan(0.25);
    expect(hits / 2000).toBeLessThan(0.35);
  });
});

describe("hashSeed", () => {
  it("결정적이고 인자 순서에 민감하다", () => {
    expect(hashSeed(1, "a", 2)).toBe(hashSeed(1, "a", 2));
    expect(hashSeed(1, "a", 2)).not.toBe(hashSeed(2, "a", 1));
    expect(hashSeed("ab")).not.toBe(hashSeed("a", "b"));
    expect(hashSeed(1)).not.toBe(hashSeed("1"));
  });

  it("32비트 부호 없는 정수", () => {
    const h = hashSeed("seed", 123);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });
});
