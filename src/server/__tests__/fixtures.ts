/**
 * 테스트 픽스처 — 계약 타입(PlayerProfile / ShiftSummary)을 만족하는 유효한 값과
 * 라우트 핸들러를 호출하기 위한 NextRequest 생성 도우미.
 */
import { NextRequest } from "next/server";
import type { ShiftSummary } from "@/engine/types";
import type { PlayerProfile } from "@/shared/player";

export function makeProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    name: "테스터",
    wage: 1050,
    totalShifts: 3,
    streak: 2,
    lastPlayDate: "2026-11-09",
    leavesLeft: 2,
    leaveMonth: "2026-11",
    tagWeights: {
      hot: 1,
      cold: 1,
      chopsticks: 1.5,
      spoon: 1,
      straw: 1,
      alcohol: 2,
      tobacco: 1,
      fragile_hot: 1,
    },
    perfectedTags: ["hot"],
    regulars: {
      salaryman: { affinity: 2, metCount: 4, lastMetDate: "2026-11-09", firstWordsHeard: ["どうも"] },
    },
    today: { date: "2026-11-09", completed: ["asa"] },
    updatedAt: "2026-11-09T01:00:00.000Z",
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<ShiftSummary> = {}): ShiftSummary {
  return {
    workplaceId: "konbini",
    slot: "asa",
    level: 1,
    playedAt: new Date().toISOString(),
    durationMs: 180_000,
    served: 8,
    missed: 1,
    questionCount: 20,
    perfects: 10,
    goods: 5,
    oks: 3,
    lates: 1,
    wrongs: 1,
    maxCombo: 9,
    spokens: 0,
    hardest: { phraseId: "p_age_check", kind: "AGE_CHECK", wrongCount: 1, lateCount: 0 },
    wageDelta: 30,
    wageAfter: 1080,
    firstSuccessTags: ["alcohol"],
    regularsMet: ["salaryman"],
    endedBy: "customers",
    answers: [
      {
        customerIndex: 0,
        kind: "WARM",
        correctPhraseId: "p_warm",
        chosenPhraseId: "p_warm",
        correct: true,
        grade: "perfect",
        reactionMs: 800,
        timedOut: false,
        attempt: 1,
        spoken: false,
      },
    ],
    ...overrides,
  };
}

interface RequestOptions {
  method?: string;
  /** 객체면 JSON 으로, 문자열이면 그대로 본문으로 보낸다 */
  body?: unknown;
  /** 이전 응답의 Set-Cookie 에서 뽑은 `baito_pid=...` 조각 */
  cookie?: string;
  query?: Record<string, string>;
}

export function makeRequest(path: string, opts: RequestOptions = {}): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  return new NextRequest(url, { method: opts.method ?? "GET", headers, body });
}

/** 응답의 Set-Cookie 에서 `baito_pid=<uuid>` 만 추출. 없으면 null */
export function extractPidCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const m = /baito_pid=([^;]+)/.exec(setCookie);
  return m ? `baito_pid=${m[1]}` : null;
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
