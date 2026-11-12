/**
 * 인게임 화면이 쓰는 순수 도우미. 엔진을 건드리지 않고 화면 쪽에서 파생하는 값만 모았다.
 * - 이 시프트에 등장 가능한 레귤러 걸러내기
 * - 익명 손님 외형(결정적), 레귤러 "처음 들은 말" 선택(결정적)
 * - 태그 → 한자 배지, 결제 수단 라벨, 속도 등급 라벨, 매장 안 시계
 */
import type {
  AnswerOption,
  CustomerReply,
  CustomerSpec,
  Direction,
  EventKind,
  ItemTag,
  ManagerLine,
  ManagerMoment,
  PaymentMethod,
  RankDef,
  RankId,
  Regular,
  RegularVisual,
  ShiftConfig,
  ShiftSlot,
  ShiftSummary,
  SpeedGrade,
  WorkplaceContent,
} from "@/engine/types";
import { isRegularUnlocked, rankAtLeast } from "@/engine/progression";
import { createRng, hashSeed } from "@/engine/rng";
import type { PlayerProfile } from "@/shared/player";
import type { IconName } from "@/components/ui";

/** 마감 직후 영수증 화면이 스토어 재렌더 전에도 읽을 수 있도록 두는 sessionStorage 키 */
export const LAST_RECEIPT_KEY = "baito.lastReceipt";

/** 말하기 모드가 전 시프트에서 열리는 직급 */
export const SPEAKING_RANK: RankId = "senpai";
/** 이 레벨 이상의 시프트에서는 직급과 무관하게 말하기 모드가 열린다(기획서: Lv3 부터) */
export const SPEAKING_LEVEL = 3;

/** 말하기 모드 해금 여부 — 선배 이상이거나, 레벨 3(夕) 시프트 */
export function isSpeakingUnlocked(profile: PlayerProfile, config: ShiftConfig, ranks: RankDef[]): boolean {
  if (config.level >= SPEAKING_LEVEL) return true;
  return rankAtLeast(profile.rank, SPEAKING_RANK, ranks);
}
/** 선택지 한국어 뜻 표시 여부 저장 키 */
export const SHOW_KO_KEY = "baito.showKo";
/** 선택지 후리가나(かな) 표시 여부 저장 키 — 값이 있으면 레벨 기본값보다 우선 */
export const SHOW_KANA_KEY = "baito.showKana";
/** 이 레벨까지는 후리가나가 기본으로 켜진다 (Lv3 부터 기본 OFF) */
export const KANA_DEFAULT_MAX_LEVEL = 2;

/** 후리가나 기본값 — 저장값이 있으면 그것, 없으면 레벨 기준 */
export function defaultShowKana(level: number, stored: string | null): boolean {
  if (stored === "1") return true;
  if (stored === "0") return false;
  return level <= KANA_DEFAULT_MAX_LEVEL;
}

/** 점장 대사 중 해당 순간(when)의 것을 시드로 하나 고른다. 없으면 null */
export function pickManagerLine(content: WorkplaceContent, when: ManagerMoment, seed: number): ManagerLine | null {
  const pool = content.manager.filter((line) => line.when === when);
  if (pool.length === 0) return null;
  return createRng(hashSeed(seed, "manager", when)).pick(pool);
}

/** 지금 직급·시간대·달에 등장 가능한 레귤러 */
export function availableRegulars(
  content: WorkplaceContent,
  profile: PlayerProfile,
  slot: ShiftSlot,
  month: number,
): Regular[] {
  return content.regulars.filter((regular) =>
    isRegularUnlocked(regular, { rank: profile.rank, slot, month, ranks: content.ranks }),
  );
}

/* ───────────────────────── 손님 외형 ───────────────────────── */

const ANON_HAIR: RegularVisual["hairStyle"][] = ["short", "long", "cap", "bun", "ponytail", "short", "hat"];
const ANON_HAIR_COLOR = ["#2B2A33", "#3B2A1F", "#5B3B2B", "#1F1F24", "#6E4A2E", "#8A6A4A"];
const ANON_OUTFIT = ["#2E3A59", "#4F6D4A", "#7A5C8E", "#8C3B3B", "#3A6B8C", "#5C5C66", "#B06A3C"];
const ANON_SKIN = ["#F3D6C2", "#F1C9A5", "#E7B48C", "#D9A078"];

/** 익명 손님 외형 — 시드와 손님 번호로 결정된다(같은 시프트를 다시 봐도 같은 손님) */
export function anonymousVisual(seed: number, customerIndex: number): Partial<RegularVisual> {
  const rng = createRng(hashSeed(seed, "visual", customerIndex));
  return {
    hairStyle: rng.pick(ANON_HAIR),
    hairColor: rng.pick(ANON_HAIR_COLOR),
    outfit: rng.pick(ANON_OUTFIT),
    skin: rng.pick(ANON_SKIN),
  };
}

/** 익명 손님 호칭 (aria-label 용) */
export function customerName(customer: CustomerSpec, regular: Regular | undefined): string {
  if (regular) return regular.nameJa;
  return `お客さん ${customer.index + 1}`;
}

/** 레귤러가 들어올 때 한마디 — 수집되는 "처음 들은 말". 시드로 결정된다 */
export function pickFirstWords(seed: number, customerIndex: number, regular: Regular): CustomerReply | null {
  if (regular.firstWords.length === 0) return null;
  const rng = createRng(hashSeed(seed, "firstWords", customerIndex));
  return rng.pick(regular.firstWords);
}

/** 레귤러가 만족하고 나갈 때의 대사 — 호감도 단계 대사, 없으면 말버릇 */
export function regularLeaveLine(regular: Regular, affinity: number): CustomerReply {
  const level = Math.max(1, Math.min(5, Math.trunc(affinity)));
  const line =
    regular.lines.find((l) => l.affinity === level) ??
    regular.lines.filter((l) => l.affinity <= level).at(-1);
  if (line) return { ja: line.ja, ko: line.ko };
  return { ja: regular.tic, ko: regular.ticKo };
}

/* ───────────────────────── 라벨 ───────────────────────── */

/** 상품 태그 → 한자 한 글자 (카운터 위 작은 배지) */
export const TAG_KANJI: Record<ItemTag, { kanji: string; ko: string }> = {
  hot: { kanji: "温", ko: "따뜻한 상품" },
  cold: { kanji: "冷", ko: "찬 상품" },
  chopsticks: { kanji: "箸", ko: "젓가락" },
  spoon: { kanji: "匙", ko: "스푼" },
  straw: { kanji: "吸", ko: "빨대" },
  alcohol: { kanji: "酒", ko: "술" },
  tobacco: { kanji: "煙", ko: "담배" },
  fragile_hot: { kanji: "熱", ko: "뜨거운 음료" },
  oden: { kanji: "お", ko: "오뎅" },
  fried: { kanji: "揚", ko: "튀김" },
};

/** 손님이 내민 결제 수단 */
export const PAYMENT_LABEL: Record<PaymentMethod, { ja: string; ko: string; icon: IconName }> = {
  cash: { ja: "現金", ko: "현금", icon: "coin" },
  ic: { ja: "IC", ko: "교통카드", icon: "card" },
  qr: { ja: "QR", ko: "QR 결제", icon: "qr" },
  credit: { ja: "クレジット", ko: "신용카드", icon: "card" },
};

/** 돌발 이벤트 손님 → 카운터 위 한자 배지 (길 묻기는 배지 대신 방향 표지) */
export const EVENT_KANJI: Record<Exclude<EventKind, "DIRECTIONS">, { kanji: string; ja: string; ko: string }> = {
  TOILET: { kanji: "手洗", ja: "お手洗い", ko: "화장실" },
  COPIER: { kanji: "複写", ja: "コピー機", ko: "복사기" },
  ATM: { kanji: "ATM", ja: "ATM", ko: "현금 인출기" },
  DELIVERY: { kanji: "宅配", ja: "宅配便", ko: "택배" },
  UTILITY_BILL: { kanji: "払込", ja: "払込票", ko: "공공요금 납부" },
  TICKET: { kanji: "券", ja: "チケット", ko: "티켓" },
};

/** 길 묻기 방향 → 표지판 라벨과 화살표 회전(위 = 0°) */
export const DIRECTION_LABEL: Record<Direction, { ja: string; ko: string; rotate: number }> = {
  straight: { ja: "まっすぐ", ko: "직진", rotate: 0 },
  right: { ja: "右", ko: "오른쪽", rotate: 90 },
  back: { ja: "後ろ", ko: "뒤쪽", rotate: 180 },
  left: { ja: "左", ko: "왼쪽", rotate: -90 },
};

/** 뒷벽 담배 선반에 보이는 번호 후보 — 지금 선택지에 있는 번호는 빼서 정답이 새지 않게 한다 */
const TOBACCO_SHELF_BASE = ["3", "8", "14", "27", "35", "46", "52", "69", "71", "88"] as const;
export const TOBACCO_SHELF_SLOTS = 5;

export function tobaccoShelfNumbers(options: AnswerOption[], hidden: string | null): string[] {
  const exclude = new Set<string>(options.map((option) => option.ja.replace(/\D/g, "")));
  if (hidden) exclude.add(hidden);
  return TOBACCO_SHELF_BASE.filter((n) => !exclude.has(n)).slice(0, TOBACCO_SHELF_SLOTS);
}

/** 속도 등급 표시 — 플레이어에게 보이는 유일한 "채점" */
export const GRADE_LABEL: Record<SpeedGrade, string> = {
  perfect: "PERFECT",
  good: "GOOD",
  ok: "OK",
  late: "LATE",
};

/* ───────────────────────── 매장 시계 ───────────────────────── */

function parseHm(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}

/**
 * 시프트 근무 시간("07:00–10:00")을 경과 비율로 환산한 매장 안 시각 "07:12".
 * 파싱 실패 시 근무 시간 문자열의 앞부분을 돌려준다.
 */
export function storeClock(hours: string, progress: number): string {
  const [from, to] = hours.split(/[–\-~]/);
  const start = from ? parseHm(from) : null;
  const end = to ? parseHm(to) : null;
  if (start === null || end === null) return hours;
  const ratio = Math.min(1, Math.max(0, progress));
  const minutes = Math.round(start + (end - start) * ratio);
  const hh = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ───────────────────────── 영수증 임시 저장 ───────────────────────── */

export function saveLastReceipt(summary: ShiftSummary): void {
  try {
    window.sessionStorage.setItem(LAST_RECEIPT_KEY, JSON.stringify(summary));
  } catch {
    /* 저장 불가(프라이빗 모드 등) — 스토어가 진실이므로 무시 */
  }
}

export function loadLastReceipt(): ShiftSummary | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_RECEIPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShiftSummary;
    return typeof parsed?.playedAt === "string" ? parsed : null;
  } catch {
    return null;
  }
}
