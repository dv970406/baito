/**
 * 영수증·공유 카드 PNG 렌더러 — 외부 라이브러리 없이 Canvas 2D 로 직접 그린다.
 * - renderReceiptPng: 마감 영수증(종이 폭 360px, 높이는 내용에 맞춰 늘어난다)
 * - renderFrozenMomentPng: 「얼어붙은 순간」 세로 공유 카드(1080×1350)
 * 두 함수 모두 canvas 를 쓸 수 없는 환경(jsdom·SSR)에서는 null 을 돌려준다.
 * 색은 theme.css 의 昼 토큰 값을 상수로 고정한다(캔버스는 CSS 변수를 읽지 못한다).
 */
import type { ShiftSummary, WorkplaceContent } from "@/engine/types";
import type { PlayerProfile } from "@/shared/player";
import { SPOKEN_BONUS } from "@/engine/progression";
import { formatReceiptDate, formatYen, formatYenDelta } from "@/lib/format";
import { examVerdict, frozenSeconds, hardestLabel, hardestTail, pickManagerLine } from "@/components/screens/receiptModel";
import { cap, type CaptionLang } from "@/i18n/caption";
import { translate } from "@/i18n/messages";

/* ───────────────────────── 토큰(昼) ───────────────────────── */

export const PNG_COLORS = {
  surface: "#f4f6f2",
  surfaceRaised: "#ffffff",
  surfaceSunken: "#e9ece6",
  ink: "#1a1d23",
  inkMuted: "#5b616e",
  border: "#dde1da",
  shell: "#1a1d23",
  brand: "#2a6df4",
  brandInk: "#ffffff",
  brandSoft: "#dce7ff",
  perfectInk: "#0e8a4f",
  irritationInk: "#c8322b",
  combo: "#b4500f",
  comboSoft: "#fff3e0",
  tip: "#f2c94c",
  tipSoft: "#fff8e6",
} as const;

/** 앱과 같은 서체 우선순위 — 캔버스는 로드된 웹폰트가 있으면 그 글꼴을 쓰고 없으면 시스템 폰트로 떨어진다 */
export const PNG_FONT_JP = '"M PLUS Rounded 1c", "Noto Sans KR", "Hiragino Sans", "Apple SD Gothic Neo", system-ui, sans-serif';
export const PNG_FONT_KO = '"Noto Sans KR", "M PLUS Rounded 1c", "Apple SD Gothic Neo", system-ui, sans-serif';

/** 영수증 종이 폭(CSS px). 실제 캔버스는 RECEIPT_SCALE 배로 그려 선명하게 */
export const RECEIPT_WIDTH = 360;
export const RECEIPT_SCALE = 2;
export const FROZEN_WIDTH = 1080;
export const FROZEN_HEIGHT = 1350;

/* ───────────────────────── 캔버스 유틸 ───────────────────────── */

type Ctx = CanvasRenderingContext2D;

/** 캔버스와 2D 컨텍스트. 지원하지 않으면 null */
function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: Ctx } | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx: Ctx | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  return { canvas, ctx };
}

/** canvas.toBlob → Promise. 실패하면 null */
function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      resolve(null);
    }
  });
}

function font(weight: number, size: number, family: string = PNG_FONT_JP): string {
  return `${weight} ${size}px ${family}`;
}

/**
 * 글자 단위 줄바꿈(일본어는 공백이 없으므로 글자 단위, 공백이 있으면 단어 경계를 우선).
 * 폰트는 호출 전에 ctx.font 로 설정돼 있어야 한다.
 */
export function wrapText(ctx: Pick<Ctx, "measureText">, text: string, maxWidth: number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  let current = "";
  const tokens = text.split(/(\s+)/).filter((t) => t.length > 0);
  const push = (line: string) => {
    if (line.length > 0) lines.push(line);
  };
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (current.length > 0) current += " ";
      continue;
    }
    if (ctx.measureText(current + token).width <= maxWidth) {
      current += token;
      continue;
    }
    // 현재 줄에 안 들어가면 줄을 바꾸고, 단어 하나가 한 줄보다 길면 글자 단위로 쪼갠다
    if (current.trim().length > 0 && ctx.measureText(token).width <= maxWidth) {
      push(current.trimEnd());
      current = token;
      continue;
    }
    for (const ch of Array.from(token)) {
      if (ctx.measureText(current + ch).width <= maxWidth || current.length === 0) {
        current += ch;
      } else {
        push(current.trimEnd());
        current = ch;
      }
    }
  }
  push(current.trimEnd());
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1].slice(0, -1)}…`;
    return cut;
  }
  return lines;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function dashedLine(ctx: Ctx, x1: number, x2: number, y: number, color: string, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** 디자인의 바코드 막대 폭 패턴(ReceiptPaper.tsx 와 같다) */
const BAR_WIDTHS = [2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2] as const;

function barcode(ctx: Ctx, centerX: number, y: number, height: number, color: string) {
  const gap = 2;
  const total = BAR_WIDTHS.reduce((sum, w) => sum + w, 0) + gap * (BAR_WIDTHS.length - 1);
  let x = centerX - total / 2;
  ctx.fillStyle = color;
  for (const w of BAR_WIDTHS) {
    ctx.fillRect(x, y, w, height);
    x += w + gap;
  }
}

/** 영수증 아래 지그재그 가장자리(8px) */
function zigzagBottom(ctx: Ctx, width: number, bottom: number, color: string, tooth = 8) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, bottom - tooth);
  let x = 0;
  let down = true;
  while (x < width) {
    x += tooth;
    ctx.lineTo(Math.min(x, width), down ? bottom : bottom - tooth);
    down = !down;
  }
  ctx.lineTo(width, bottom);
  ctx.lineTo(0, bottom);
  ctx.closePath();
  ctx.fill();
}

/* ───────────────────────── 1. 마감 영수증 ───────────────────────── */

export interface ReceiptPngOptions {
  /** 영수증 바닥 "DAY n" */
  day?: number;
  /** 일본어 라벨 옆 작은 자막 언어 (기본 ko) */
  lang?: CaptionLang;
}

interface Row {
  labelJa: string;
  labelKo: string;
  value: string;
  tone?: "default" | "perfect" | "irritation";
}

/**
 * 마감 영수증 PNG. 폭 360(×2 배율) · 높이는 내용에 맞춤.
 * 화면의 ReceiptScreen 과 같은 순서로 그린다: 머리 → 응대 행 → 시급 → 가장 헷갈린 한마디 → 단골 → 점장 → 바코드.
 */
export async function renderReceiptPng(
  summary: ShiftSummary,
  profile: Pick<PlayerProfile, "name">,
  content: WorkplaceContent,
  options: ReceiptPngOptions = {},
): Promise<Blob | null> {
  const probe = createCanvas(1, 1);
  if (!probe) return null;

  const config = content.shifts[summary.slot];
  const lang: CaptionLang = options.lang ?? "ko";
  const tr = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(lang, key, vars);
  const W = RECEIPT_WIDTH;
  const PAD = 20;
  const inner = W - PAD * 2;
  const rows: Row[] = [
    { labelJa: "応対", labelKo: tr("receipt.served"), value: `${summary.served}名 / ${config.customerCount}` },
    { labelJa: "離脱", labelKo: tr("receipt.missed"), value: `${summary.missed}名`, tone: summary.missed > 0 ? "irritation" : "default" },
    { labelJa: "最大コンボ", labelKo: tr("receipt.maxCombo"), value: `×${summary.maxCombo}` },
  ];
  if (summary.spokens > 0) {
    rows.push({
      labelJa: "声で答えた",
      labelKo: tr("receipt.spoken"),
      value: tr("receipt.spokenValue", { n: summary.spokens, bonus: summary.spokens * SPOKEN_BONUS }),
      tone: "perfect",
    });
  }
  if (summary.events > 0) {
    rows.push({ labelJa: "突発対応", labelKo: tr("receipt.events"), value: `${summary.events}件` });
  }
  const exam = examVerdict(content, summary);
  const hardest = hardestLabel(content, summary.hardest, lang);
  const regularsMet = summary.regularsMet
    .map((id) => content.regulars.find((r) => r.id === id)?.nameJa)
    .filter((n): n is string => Boolean(n));
  const manager = pickManagerLine(content, summary);
  const wageBefore = summary.wageAfter - summary.wageDelta;

  // 1차: 줄바꿈 계산을 위해 측정 컨텍스트에 폰트를 맞춘다
  const measure = probe.ctx;
  measure.font = font(800, 16);
  const hardestJaLines = hardest ? wrapText(measure, hardest.ja, inner - 24, 3) : [];
  measure.font = font(500, 11, PNG_FONT_KO);
  const hardestKoLines = hardest
    ? wrapText(measure, [hardest.ko, summary.hardest ? hardestTail(summary.hardest, lang) : ""].filter(Boolean).join(" · "), inner - 24, 2)
    : [];
  measure.font = font(700, 13);
  const managerJaLines = manager ? wrapText(measure, manager.ja, inner - 44, 3) : [];
  measure.font = font(500, 11, PNG_FONT_KO);
  const managerKoLines = manager ? wrapText(measure, cap(manager, lang), inner - 44, 2) : [];

  // 내용 높이는 그리면서 정해지므로 넉넉한 캔버스에 그린 뒤 실제 높이로 잘라낸다
  const MAX_H = 1600;
  const made = createCanvas(W * RECEIPT_SCALE, MAX_H * RECEIPT_SCALE);
  if (!made) return null;
  const { canvas: draft, ctx } = made;
  ctx.scale(RECEIPT_SCALE, RECEIPT_SCALE);

  // 종이
  ctx.fillStyle = PNG_COLORS.surfaceRaised;
  ctx.fillRect(0, 0, W, MAX_H);
  ctx.textBaseline = "top";

  let y = 22;
  const center = W / 2;

  // 머리
  ctx.textAlign = "center";
  ctx.fillStyle = PNG_COLORS.ink;
  ctx.font = font(800, 20);
  ctx.fillText(content.storeNameJa, center, y);
  y += 28;
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 12);
  ctx.fillText(`${content.storeBranchJa} · ${content.registerLabel}`, center, y);
  y += 16;
  ctx.fillText(formatReceiptDate(summary.playedAt, config.kanji, config.hours), center, y);
  y += 16;
  ctx.fillText(`担当 ${profile.name}`, center, y);
  y += 18;

  // 승급 시험 블록
  if (exam) {
    y += 10;
    const boxH = 70;
    ctx.fillStyle = exam.passed ? PNG_COLORS.brandSoft : PNG_COLORS.surfaceSunken;
    roundRect(ctx, PAD, y, inner, boxH, 10);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = exam.passed ? PNG_COLORS.brand : PNG_COLORS.inkMuted;
    ctx.font = font(800, 11);
    ctx.fillText(`店長点検 · ${tr("receipt.examTitle")}`, PAD + 12, y + 10);
    ctx.fillStyle = PNG_COLORS.ink;
    ctx.font = font(800, 20);
    ctx.fillText(exam.passed ? "合格" : "不合格", PAD + 12, y + 26);
    ctx.textAlign = "right";
    ctx.font = font(700, 12);
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.fillText(`基準 ×${exam.comboRequired} · 最高 ×${exam.maxCombo} · 離脱 ${exam.missed}`, PAD + inner - 12, y + 28);
    ctx.font = font(500, 11, PNG_FONT_KO);
    ctx.fillText(
      exam.passed && exam.rank
        ? `${tr("receipt.newTag")} · ${exam.rank.ja} ${cap(exam.rank, lang)}`
        : tr("receipt.retryNextMondayShort"),
      PAD + inner - 12,
      y + 48,
    );
    y += boxH + 4;
  }

  dashedLine(ctx, PAD, W - PAD, y + 7, PNG_COLORS.border);
  y += 14;

  // 응대 행
  const drawRow = (row: Row) => {
    ctx.textAlign = "left";
    ctx.fillStyle = PNG_COLORS.ink;
    ctx.font = font(700, 14);
    ctx.fillText(row.labelJa, PAD, y + 2);
    const jaWidth = ctx.measureText(row.labelJa).width;
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(500, 11, PNG_FONT_KO);
    ctx.fillText(row.labelKo, PAD + jaWidth + 6, y + 5);
    ctx.textAlign = "right";
    ctx.font = font(700, 14);
    ctx.fillStyle =
      row.tone === "perfect" ? PNG_COLORS.perfectInk : row.tone === "irritation" ? PNG_COLORS.irritationInk : PNG_COLORS.ink;
    ctx.fillText(row.value, W - PAD, y + 2);
    y += 22;
  };
  drawRow(rows[0]);
  drawRow(rows[1]);

  // 등급 4칸
  y += 6;
  const grades: [string, number, string][] = [
    ["Perfect", summary.perfects, summary.perfects > 0 ? PNG_COLORS.perfectInk : PNG_COLORS.ink],
    ["Good", summary.goods, PNG_COLORS.ink],
    ["OK", summary.oks, PNG_COLORS.ink],
    ["Late", summary.lates, summary.lates > 0 ? PNG_COLORS.combo : PNG_COLORS.ink],
  ];
  const cellGap = 6;
  const cellW = (inner - cellGap * 3) / 4;
  grades.forEach(([label, value, color], i) => {
    const x = PAD + i * (cellW + cellGap);
    ctx.fillStyle = PNG_COLORS.surfaceSunken;
    roundRect(ctx, x, y, cellW, 46, 8);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(700, 10);
    ctx.fillText(label, x + cellW / 2, y + 8);
    ctx.fillStyle = color;
    ctx.font = font(800, 17);
    ctx.fillText(String(value), x + cellW / 2, y + 22);
  });
  y += 46 + 12;
  for (const row of rows.slice(2)) drawRow(row);

  dashedLine(ctx, PAD, W - PAD, y + 7, PNG_COLORS.border);
  y += 14;

  // 시급
  y += 10;
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.ink;
  ctx.font = font(800, 14);
  ctx.fillText("今日の時給", PAD, y + 8);
  const wageLabelW = ctx.measureText("今日の時給").width;
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 11, PNG_FONT_KO);
  ctx.fillText(tr("receipt.todayWage"), PAD + wageLabelW + 6, y + 11);
  ctx.textAlign = "right";
  ctx.fillStyle = PNG_COLORS.ink;
  ctx.font = font(800, 26);
  ctx.fillText(formatYen(summary.wageAfter), W - PAD, y);
  y += 34;
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 11);
  ctx.fillText(`${formatYen(wageBefore)} → ${formatYen(summary.wageAfter)}`, PAD, y);
  ctx.textAlign = "right";
  ctx.fillStyle =
    summary.wageDelta > 0 ? PNG_COLORS.perfectInk : summary.wageDelta < 0 ? PNG_COLORS.irritationInk : PNG_COLORS.inkMuted;
  ctx.font = font(700, 11);
  ctx.fillText(formatYenDelta(summary.wageDelta), W - PAD, y);
  y += 20;

  dashedLine(ctx, PAD, W - PAD, y + 7, PNG_COLORS.border);
  y += 14;

  // 가장 헷갈린 한마디
  y += 10;
  const boxH = 24 + hardestJaLines.length * 22 + hardestKoLines.length * 15 + 12;
  ctx.fillStyle = PNG_COLORS.comboSoft;
  roundRect(ctx, PAD, y, inner, Math.max(boxH, 64), 10);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.combo;
  ctx.font = font(800, 11);
  ctx.fillText(`一番迷った一言 · ${tr("receipt.hardest")}`, PAD + 12, y + 10);
  let ty = y + 26;
  ctx.fillStyle = PNG_COLORS.ink;
  ctx.font = font(800, 16);
  if (hardest) {
    for (const line of hardestJaLines) {
      ctx.fillText(line, PAD + 12, ty);
      ty += 22;
    }
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(500, 11, PNG_FONT_KO);
    for (const line of hardestKoLines) {
      ctx.fillText(line, PAD + 12, ty);
      ty += 15;
    }
  } else {
    ctx.fillText("なし", PAD + 12, ty);
    ty += 22;
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(500, 11, PNG_FONT_KO);
    ctx.fillText(tr("receipt.noHardest"), PAD + 12, ty);
  }
  y += Math.max(boxH, 64) + 4;

  // 처음 성공
  if (summary.firstSuccessTags.length > 0) {
    y += 8;
    ctx.textAlign = "left";
    ctx.fillStyle = PNG_COLORS.ink;
    ctx.font = font(700, 13);
    ctx.fillText("初めて成功", PAD, y);
    ctx.textAlign = "right";
    ctx.fillStyle = PNG_COLORS.perfectInk;
    ctx.font = font(700, 13);
    ctx.fillText(`+¥40 ×${summary.firstSuccessTags.length}`, W - PAD, y);
    y += 18;
  }

  // 만난 단골
  if (regularsMet.length > 0) {
    y += 8;
    ctx.textAlign = "left";
    ctx.fillStyle = PNG_COLORS.ink;
    ctx.font = font(700, 13);
    ctx.fillText("会った常連", PAD, y);
    ctx.textAlign = "right";
    ctx.font = font(700, 13);
    ctx.fillText(regularsMet.join(" · "), W - PAD, y);
    y += 18;
  }

  // 점장 한마디
  if (manager) {
    y += 14;
    ctx.fillStyle = PNG_COLORS.tip;
    roundRect(ctx, PAD, y, 32, 24, 6);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = PNG_COLORS.ink;
    ctx.font = font(800, 10);
    ctx.fillText("店長", PAD + 16, y + 7);
    ctx.textAlign = "left";
    let my = y;
    ctx.font = font(700, 13);
    for (const line of managerJaLines) {
      ctx.fillText(line, PAD + 42, my);
      my += 18;
    }
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(500, 11, PNG_FONT_KO);
    for (const line of managerKoLines) {
      ctx.fillText(line, PAD + 42, my);
      my += 15;
    }
    y = Math.max(my, y + 28);
  }

  // 바코드 + 바닥
  y += 16;
  barcode(ctx, center, y, 28, PNG_COLORS.shell);
  y += 34;
  ctx.textAlign = "center";
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(700, 10);
  ctx.fillText(`BAITO · ${content.code} · DAY ${Math.max(1, options.day ?? 1)}`, center, y);
  y += 14 + 26; // 바닥 글자 + 하단 패딩

  // 실제 높이로 잘라내고 지그재그 가장자리를 붙인다
  const H = Math.ceil(y);
  const final = createCanvas(W * RECEIPT_SCALE, H * RECEIPT_SCALE);
  if (!final) return null;
  final.ctx.drawImage(draft, 0, 0, W * RECEIPT_SCALE, H * RECEIPT_SCALE, 0, 0, W * RECEIPT_SCALE, H * RECEIPT_SCALE);
  final.ctx.scale(RECEIPT_SCALE, RECEIPT_SCALE);
  zigzagBottom(final.ctx, W, H, PNG_COLORS.surface);

  return toBlob(final.canvas);
}

/* ───────────────────────── 2. 얼어붙은 순간 카드 ───────────────────────── */

/**
 * 「この一瞬」 공유 카드(1080×1350). 가장 헷갈린 한마디를 크게, 한국어는 작게,
 * 「〇秒 固まった」 한 줄과 시급 변화, BAITO 워드마크(텍스트). hardest 가 없으면 null.
 */
export async function renderFrozenMomentPng(
  summary: ShiftSummary,
  content: WorkplaceContent,
  lang: CaptionLang = "ko",
): Promise<Blob | null> {
  const hardest = hardestLabel(content, summary.hardest, lang);
  if (!hardest || !summary.hardest) return null;
  const made = createCanvas(FROZEN_WIDTH, FROZEN_HEIGHT);
  if (!made) return null;
  const { canvas, ctx } = made;
  const W = FROZEN_WIDTH;
  const H = FROZEN_HEIGHT;
  const PAD = 84;
  const config = content.shifts[summary.slot];
  const seconds = frozenSeconds(summary);
  const wageBefore = summary.wageAfter - summary.wageDelta;

  // 배경 — 편의점 블루(accent) 위에 흰 종이
  ctx.fillStyle = PNG_COLORS.brand;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "top";

  // 상단 라벨
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.brandInk;
  ctx.font = font(800, 34);
  ctx.fillText(`${content.storeNameJa} ${content.storeBranchJa}`, PAD, PAD);
  ctx.globalAlpha = 0.8;
  ctx.font = font(700, 28);
  ctx.fillText(`${config.kanji}シフト · ${config.hours}`, PAD, PAD + 48);
  ctx.globalAlpha = 1;

  // 종이 — 워드마크 위 60px 까지 채운다
  const markY = H - PAD - 64;
  const paperY = PAD + 130;
  const paperH = markY - 60 - paperY;
  ctx.fillStyle = PNG_COLORS.surfaceRaised;
  roundRect(ctx, PAD, paperY, W - PAD * 2, paperH, 36);
  ctx.fill();

  const innerX = PAD + 64;
  const innerW = W - (PAD + 64) * 2;
  let y = paperY + 64;

  ctx.fillStyle = PNG_COLORS.combo;
  ctx.font = font(800, 28);
  ctx.fillText("一番迷った一言", innerX, y);
  y += 40;
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 24, PNG_FONT_KO);
  ctx.fillText(translate(lang, "receipt.hardest"), innerX, y);
  y += 72;

  // 일본어 크게(최대 3줄, 길면 글자를 줄인다)
  let jaSize = 92;
  let jaLines: string[] = [];
  for (;;) {
    ctx.font = font(800, jaSize);
    jaLines = wrapText(ctx, hardest.ja, innerW);
    if (jaLines.length <= 3 || jaSize <= 56) break;
    jaSize -= 8;
  }
  jaLines = jaLines.slice(0, 3);
  ctx.fillStyle = PNG_COLORS.ink;
  for (const line of jaLines) {
    ctx.fillText(line, innerX, y);
    y += jaSize * 1.2;
  }
  if (hardest.reading) {
    y += 8;
    ctx.fillStyle = PNG_COLORS.inkMuted;
    ctx.font = font(500, 28);
    for (const line of wrapText(ctx, hardest.reading, innerW, 2)) {
      ctx.fillText(line, innerX, y);
      y += 36;
    }
  }
  y += 20;
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 32, PNG_FONT_KO);
  for (const line of wrapText(ctx, hardest.ko, innerW, 2)) {
    ctx.fillText(line, innerX, y);
    y += 42;
  }

  // 「〇秒 固まった」
  y += 48;
  dashedLine(ctx, innerX, innerX + innerW, y, PNG_COLORS.border, 4);
  y += 40;
  const frozenJa = seconds !== null ? `${seconds}秒 固まった` : `${summary.hardest.wrongCount + summary.hardest.lateCount}回 迷った`;
  const frozenKo =
    seconds !== null
      ? translate(lang, "receipt.frozenSeconds", { s: seconds })
      : translate(lang, "receipt.frozenHesitated", { n: summary.hardest.wrongCount + summary.hardest.lateCount });
  ctx.fillStyle = PNG_COLORS.irritationInk;
  ctx.font = font(800, 56);
  ctx.fillText(frozenJa, innerX, y);
  y += 70;
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 28, PNG_FONT_KO);
  ctx.fillText(frozenKo, innerX, y);

  // 시급 변화(종이 바닥에 고정)
  const wageY = paperY + paperH - 120;
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.ink;
  ctx.font = font(800, 30);
  ctx.fillText("今日の時給", innerX, wageY);
  ctx.fillStyle = PNG_COLORS.inkMuted;
  ctx.font = font(500, 26);
  ctx.fillText(`${formatYen(wageBefore)} → ${formatYen(summary.wageAfter)}`, innerX, wageY + 44);
  ctx.textAlign = "right";
  ctx.fillStyle =
    summary.wageDelta > 0 ? PNG_COLORS.perfectInk : summary.wageDelta < 0 ? PNG_COLORS.irritationInk : PNG_COLORS.inkMuted;
  ctx.font = font(800, 56);
  ctx.fillText(formatYenDelta(summary.wageDelta), innerX + innerW, wageY + 4);

  // 워드마크 — 「バ」 배지 + BAITO, 오른쪽에 직장 코드
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.brandInk;
  roundRect(ctx, PAD, markY, 64, 64, 14);
  ctx.fill();
  ctx.fillStyle = PNG_COLORS.brand;
  ctx.textAlign = "center";
  ctx.font = font(800, 36);
  ctx.fillText("バ", PAD + 32, markY + 12);
  ctx.textAlign = "left";
  ctx.fillStyle = PNG_COLORS.brandInk;
  ctx.font = font(800, 44);
  ctx.fillText("BAITO", PAD + 84, markY + 8);
  ctx.textAlign = "right";
  ctx.globalAlpha = 0.8;
  ctx.font = font(700, 24);
  ctx.fillText(`${content.code} · ${translate(lang, "receipt.tagline")}`, W - PAD, markY + 22);
  ctx.globalAlpha = 1;

  return toBlob(canvas);
}
