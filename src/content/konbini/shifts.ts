import type { RankDef, ShiftConfig, ShiftSlot } from "@/engine/types";

/** KONBINI 시프트 3개(朝·昼·夕). 레벨이 올라갈수록 태그가 늘고 질문 제한 시간이 줄어든다. */
export const konbiniShifts: Record<ShiftSlot, ShiftConfig> = {
  asa: {
    slot: "asa",
    kanji: "朝",
    nameKo: "아침",
    hours: "07:00–10:00",
    level: 1,
    durationSec: 180,
    customerCount: 8,
    questionTimeSec: 6,
    activeTags: ["hot", "chopsticks"],
    pointCardChance: 0,
    itemsPerCustomer: [1, 2],
    descriptionKo: "손님 느림 · 질문 1~2개",
  },
  hiru: {
    slot: "hiru",
    kanji: "昼",
    nameKo: "점심",
    hours: "11:30–14:00",
    level: 2,
    durationSec: 210,
    customerCount: 10,
    questionTimeSec: 5,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "fragile_hot"],
    pointCardChance: 0.25,
    itemsPerCustomer: [1, 3],
    descriptionKo: "손님 몰림 · 봉투 분리 질문 등장",
  },
  yoru: {
    slot: "yoru",
    kanji: "夕",
    nameKo: "저녁",
    hours: "17:00–20:00",
    level: 3,
    durationSec: 240,
    customerCount: 12,
    questionTimeSec: 4.5,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "alcohol", "tobacco", "fragile_hot"],
    pointCardChance: 0.35,
    itemsPerCustomer: [1, 3],
    descriptionKo: "술·담배 등장 · 연령 확인",
  },
};

/** 직급. shiftsRequired 오름차순. 선배가 되면 술·담배 판매 권한이 열린다. */
export const konbiniRanks: RankDef[] = [
  { id: "shinjin", ja: "新人", ko: "신입", shiftsRequired: 0, unlocksTags: [] },
  { id: "ippan", ja: "一般", ko: "일반 알바", shiftsRequired: 3, unlocksTags: [] },
  { id: "senpai", ja: "先輩", ko: "선배", shiftsRequired: 10, unlocksTags: ["alcohol", "tobacco"] },
  { id: "leader", ja: "時間帯リーダー", ko: "시간대 리더", shiftsRequired: 20, unlocksTags: [] },
  { id: "fukutencho", ja: "副店長", ko: "부점장", shiftsRequired: 35, unlocksTags: [] },
  { id: "tencho", ja: "店長", ko: "점장", shiftsRequired: 50, unlocksTags: [] },
];
