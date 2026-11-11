import type { WorkplaceId } from "@/engine/types";

/** 직장 선택 화면용 메타 정보 (콘텐츠 본문과 분리) */
export interface WorkplaceMeta {
  id: WorkplaceId;
  /** KONBINI / HOTERU … 헵번식 로마자 대문자 */
  code: string;
  nameKo: string;
  nameJa: string;
  /** 예: "체크인 · 룸 안내 · 컴플레인" */
  summaryKo: string;
  status: "open" | "locked" | "travel";
  unlockHintKo: string;
  /** 예: "workplace-hoteru" — 테마 토큰 이름 */
  accentToken: string;
}

export const workplaces: WorkplaceMeta[] = [
  {
    id: "konbini",
    code: "KONBINI",
    nameKo: "편의점",
    nameJa: "コンビニ",
    summaryKo: "주문 · 온도 · 봉투 · 결제",
    status: "open",
    unlockHintKo: "",
    accentToken: "workplace-konbini",
  },
  {
    id: "hoteru",
    code: "HOTERU",
    nameKo: "호텔 프론트",
    nameJa: "ホテル",
    summaryKo: "체크인 · 룸 안내 · 컴플레인",
    status: "locked",
    unlockHintKo: "KONBINI 점장 달성 시 지원 가능",
    accentToken: "workplace-hoteru",
  },
  {
    id: "shokudo",
    code: "SHOKUDO",
    nameKo: "식당",
    nameJa: "食堂",
    summaryKo: "주문 · 토핑 · 알레르기 · 회계",
    status: "locked",
    unlockHintKo: "KONBINI 점장 달성 시 지원 가능",
    accentToken: "workplace-shokudo",
  },
  {
    id: "kuko",
    code: "KUKO",
    nameKo: "공항",
    nameJa: "空港",
    summaryKo: "체크인 · 수하물 · 게이트 안내",
    status: "travel",
    unlockHintKo: "여행 D-7에 단기 알바로 열림",
    accentToken: "workplace-kuko",
  },
];
