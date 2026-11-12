/**
 * 마감 영수증 화면의 순수 도우미 — 점장 한마디 선택, 공유 문구, 라벨.
 */
import type { HardestPhrase, ManagerLine, ManagerMoment, RankDef, ShiftSummary, WorkplaceContent } from "@/engine/types";
import { LISTEN_PREFIX, TOBACCO_PICK_PREFIX } from "@/engine/distractor";
import { hashSeed } from "@/engine/rng";
import { formatShortDate, formatYen, formatYenDelta } from "@/lib/format";
import { cap, type CaptionLang } from "@/i18n/caption";
import { translate } from "@/i18n/messages";

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

/** 공유 문구 — 일본어 한 줄 + 자막 언어(ko/en) 두 줄 */
export function buildShareText(content: WorkplaceContent, summary: ShiftSummary, lang: CaptionLang = "ko"): string {
  const config = content.shifts[summary.slot];
  const lines = [
    `${content.storeNameJa} ${content.storeBranchJa} · ${config.kanji}シフト お疲れさまでした`,
    translate(lang, "share.served", { served: summary.served, perfects: summary.perfects, combo: summary.maxCombo }),
    translate(lang, "share.wage", {
      wage: formatYen(summary.wageAfter),
      delta: formatYenDelta(summary.wageDelta),
      code: content.code,
    }),
  ];
  return lines.join("\n");
}

/** 공유 결과 → 안내 문구 (없으면 토스트를 띄우지 않는다) */
export function shareToast(
  result: "shared" | "copied" | "unsupported" | "cancelled",
  lang: CaptionLang = "ko",
): string | null {
  switch (result) {
    case "shared":
      return translate(lang, "toast.shared");
    case "copied":
      return translate(lang, "toast.copied");
    case "unsupported":
      return translate(lang, "toast.unsupported");
    default:
      return null;
  }
}

/** 지난 영수증 목록용 짧은 날짜 — ko "11/10" · en "Nov 10" */
export function shortDate(iso: string, lang: CaptionLang = "ko"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(5, 10).replace("-", "/");
  return formatShortDate(d, lang);
}

/* ───────────────────────── 가장 헷갈린 한마디 ───────────────────────── */

export interface HardestLabel {
  ja: string;
  /** 자막 — 자막 언어(ko/en)로 고른 번역. en 이 없으면 ko */
  ko: string;
  /** 접객 문구(phrases)에서 찾았으면 그 읽기 */
  reading?: string;
}

/** 금액 템플릿(合計で {total}円です)은 손님별 금액이 없으므로 〇〇 로 중립 표기 */
export function neutralTemplate(text: string): string {
  return text.replace("{total}", "〇〇");
}

/**
 * hardest 의 표시 문구. 합성 id(담배 번호 매칭 `tobacco.pick.*`, 리스닝 `listen.*`)는 phrases 에 없으므로
 * 고정 라벨을 쓰고, 그 외는 phrases 에서 찾는다. 못 찾으면 null(「なし」 로 그린다).
 */
export function hardestLabel(
  content: WorkplaceContent,
  hardest: HardestPhrase | null,
  lang: CaptionLang = "ko",
): HardestLabel | null {
  if (!hardest) return null;
  if (hardest.phraseId.startsWith(TOBACCO_PICK_PREFIX)) {
    return { ja: "タバコの番号", ko: translate(lang, "receipt.hardestTobacco") };
  }
  if (hardest.phraseId.startsWith(LISTEN_PREFIX)) {
    return { ja: "お客さんの一言", ko: translate(lang, "receipt.hardestListen") };
  }
  const phrase = content.phrases.find((p) => p.id === hardest.phraseId);
  if (!phrase) return null;
  return { ja: neutralTemplate(phrase.ja), ko: neutralTemplate(cap(phrase, lang)), reading: phrase.reading };
}

/** hardest 의 "N번 다른 말 · N번 늦게" 꼬리 문구(자막 언어) (둘 다 0 이면 빈 문자열) */
export function hardestTail(hardest: HardestPhrase, lang: CaptionLang = "ko"): string {
  return [
    hardest.wrongCount > 0 ? translate(lang, "receipt.hardestWrong", { n: hardest.wrongCount }) : null,
    hardest.lateCount > 0 ? translate(lang, "receipt.hardestLate", { n: hardest.lateCount }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * 얼어붙은 시간(초, 소수 1자리) — hardest 질문에서 가장 오래 걸린 응답.
 * answers 가 비어 있거나(서버에서 잘린 세션) 해당 기록이 없으면 null.
 */
export function frozenSeconds(summary: ShiftSummary): number | null {
  if (!summary.hardest) return null;
  const id = summary.hardest.phraseId;
  let max = 0;
  for (const a of summary.answers) {
    if (a.correctPhraseId !== id) continue;
    if (a.reactionMs > max) max = a.reactionMs;
  }
  if (max <= 0) return null;
  return Math.round(max / 100) / 10;
}

/* ───────────────────────── 승급 시험 ───────────────────────── */

export interface ExamVerdict {
  passed: boolean;
  /** 합격 기준 콤보 */
  comboRequired: number;
  maxCombo: number;
  missed: number;
  /** 시험 대상 직급(합격이면 새 명찰) */
  rank: RankDef | null;
}

/** summary.exam → 영수증 「店長点検」 블록에 필요한 값. 시험이 아니면 null */
export function examVerdict(content: WorkplaceContent, summary: ShiftSummary): ExamVerdict | null {
  if (!summary.exam) return null;
  return {
    passed: summary.exam.passed,
    comboRequired: summary.exam.comboRequired,
    maxCombo: summary.maxCombo,
    missed: summary.missed,
    rank: content.ranks.find((r) => r.id === summary.exam?.rank) ?? null,
  };
}
