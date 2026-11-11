/**
 * 마감 영수증 화면의 순수 도우미 — 점장 한마디 선택, 공유 문구, 라벨.
 */
import type { ManagerLine, ManagerMoment, ShiftSummary, WorkplaceContent } from "@/engine/types";
import { hashSeed } from "@/engine/rng";
import { formatYen, formatYenDelta } from "@/lib/format";

/** (Perfect+Good)/질문 수 비율로 점장 반응을 가른다 */
export const MANAGER_GOOD_RATIO = 0.75;
export const MANAGER_MID_RATIO = 0.45;

export function managerMoment(summary: ShiftSummary): Extract<ManagerMoment, `shift_end_${string}`> {
  if (summary.endedBy === "manager") return "shift_end_bad";
  const ratio = summary.questionCount > 0 ? (summary.perfects + summary.goods) / summary.questionCount : 0;
  if (ratio >= MANAGER_GOOD_RATIO) return "shift_end_good";
  if (ratio >= MANAGER_MID_RATIO) return "shift_end_mid";
  return "shift_end_bad";
}

/** 점장 한마디 — 같은 영수증은 항상 같은 말(playedAt 으로 결정) */
export function pickManagerLine(content: WorkplaceContent, summary: ShiftSummary): ManagerLine | null {
  const moment = managerMoment(summary);
  const pool = content.manager.filter((line) => line.when === moment && (!line.slot || line.slot === summary.slot));
  if (pool.length === 0) return null;
  return pool[hashSeed(summary.playedAt, moment) % pool.length];
}

/** 공유 문구 — 일본어 한 줄 + 한국어 두 줄 */
export function buildShareText(content: WorkplaceContent, summary: ShiftSummary): string {
  const config = content.shifts[summary.slot];
  const lines = [
    `${content.storeNameJa} ${content.storeBranchJa} · ${config.kanji}シフト お疲れさまでした`,
    `손님 ${summary.served}名 응대 · Perfect ${summary.perfects} · 최고 콤보 ×${summary.maxCombo}`,
    `오늘 시급 ${formatYen(summary.wageAfter)} (${formatYenDelta(summary.wageDelta)}) #BAITO #${content.code}`,
  ];
  return lines.join("\n");
}

/** 공유 결과 → 안내 문구 (없으면 토스트를 띄우지 않는다) */
export function shareToast(result: "shared" | "copied" | "unsupported" | "cancelled"): string | null {
  switch (result) {
    case "shared":
      return "공유했어요";
    case "copied":
      return "복사됐어요";
    case "unsupported":
      return "이 브라우저에서는 공유할 수 없어요";
    default:
      return null;
  }
}

/** 지난 영수증 목록용 짧은 날짜 "11/10" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10).replace("-", "/");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
