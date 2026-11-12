import type { RankDef, ShiftConfig, ShiftSlot } from "@/engine/types";

/**
 * KONBINI 시프트 4개(朝·昼·夕 + 추가 근무 深夜).
 * 레벨이 올라갈수록 태그가 늘고 질문 제한 시간이 줄어들며, Lv2 부터 가려진 선택지·리스닝 단계,
 * Lv3 부터 돌발 이벤트·관광객, Lv4(심야, 선배부터)에서 취객·오뎅·튀김이 등장한다.
 */
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
    maskChance: 0.25,
    listenChance: 0.2,
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
    maskChance: 0.3,
    listenChance: 0.25,
    eventChance: 0.1,
    touristChance: 0.1,
  },
  shinya: {
    slot: "shinya",
    kanji: "深",
    nameKo: "심야",
    hours: "23:00–02:00",
    level: 4,
    durationSec: 270,
    customerCount: 12,
    questionTimeSec: 4,
    activeTags: ["hot", "cold", "chopsticks", "spoon", "straw", "alcohol", "tobacco", "fragile_hot", "oden", "fried"],
    pointCardChance: 0.4,
    itemsPerCustomer: [1, 3],
    descriptionKo: "취객·돌발 손님 · 오뎅·튀김 · 선배부터",
    maskChance: 0.35,
    listenChance: 0.3,
    eventChance: 0.22,
    drunkChance: 0.2,
    touristChance: 0.12,
    requiredRank: "senpai",
    optional: true,
  },
};

/**
 * 직급. shiftsRequired 오름차순 — 그 수를 채우면 주 1회 "점장 점검 시프트"(승급 시험)를 볼 수 있고,
 * 최고 콤보 기준을 넘기고 이탈 0 이면 승급한다. 선배가 되면 술·담배 판매 권한과 심야 근무가 열린다.
 */
export const konbiniRanks: RankDef[] = [
  { id: "shinjin", ja: "新人", ko: "신입", shiftsRequired: 0, unlocksTags: [] },
  { id: "ippan", ja: "一般", ko: "일반 알바", shiftsRequired: 3, unlocksTags: [], exam: { slot: "asa", combo: 6 } },
  {
    id: "senpai",
    ja: "先輩",
    ko: "선배",
    shiftsRequired: 10,
    unlocksTags: ["alcohol", "tobacco"],
    exam: { slot: "hiru", combo: 10 },
  },
  { id: "leader", ja: "時間帯リーダー", ko: "시간대 리더", shiftsRequired: 20, unlocksTags: [], exam: { slot: "yoru", combo: 14 } },
  { id: "fukutencho", ja: "副店長", ko: "부점장", shiftsRequired: 35, unlocksTags: [], exam: { slot: "yoru", combo: 17 } },
  { id: "tencho", ja: "店長", ko: "점장", shiftsRequired: 50, unlocksTags: [], exam: { slot: "shinya", combo: 20 } },
];
