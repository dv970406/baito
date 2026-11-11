import type { CustomerReply, QuestionKind } from "@/engine/types";

/** 정답 시 손님의 짧은 응답 후보 (질문 종류별) */
export const konbiniReplies: Record<QuestionKind, CustomerReply[]> = {
  AGE_CHECK: [
    { ja: "はい", ko: "네" },
    { ja: "はいはい", ko: "네네" },
    { ja: "押しました", ko: "눌렀어요" },
    { ja: "ああ、これね", ko: "아, 이거요" },
  ],
  POINT_CARD: [
    { ja: "ないです", ko: "없어요" },
    { ja: "あります", ko: "있어요" },
    { ja: "あ、これで", ko: "아, 이걸로" },
    { ja: "持ってないです", ko: "안 가지고 있어요" },
  ],
  WARM: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "大丈夫です", ko: "괜찮아요" },
    { ja: "はい、温めて", ko: "네, 데워 주세요" },
    { ja: "そのままで", ko: "그대로요" },
  ],
  SEPARATE_BAG: [
    { ja: "別々で", ko: "따로요" },
    { ja: "一緒でいいです", ko: "같이 넣어도 돼요" },
    { ja: "あ、お願いします", ko: "아, 부탁해요" },
  ],
  BAG: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "いらないです", ko: "필요 없어요" },
    { ja: "一枚で", ko: "한 장으로" },
    { ja: "持ってます", ko: "가지고 있어요" },
  ],
  CHOPSTICKS: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "いらないです", ko: "필요 없어요" },
    { ja: "一つで", ko: "하나요" },
  ],
  SPOON: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "大丈夫です", ko: "괜찮아요" },
    { ja: "あ、ください", ko: "아, 주세요" },
  ],
  STRAW: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "いらないです", ko: "필요 없어요" },
    { ja: "はい、一本", ko: "네, 하나요" },
  ],
  TOTAL: [
    { ja: "はい", ko: "네" },
    { ja: "じゃあこれで", ko: "그럼 이걸로" },
    { ja: "はいはい", ko: "네네" },
  ],
  PAY: [
    { ja: "お願いします", ko: "부탁해요" },
    { ja: "はい", ko: "네" },
    { ja: "これで", ko: "이걸로" },
    { ja: "どうぞ", ko: "여기요" },
  ],
  CAUTION_HOT: [
    { ja: "どうも", ko: "고마워요" },
    { ja: "はい", ko: "네" },
    { ja: "ありがとう", ko: "고마워요" },
  ],
};

/** 오답 시 손님의 당황 리액션 */
export const konbiniConfusedReplies: CustomerReply[] = [
  { ja: "え？", ko: "네…?" },
  { ja: "いや、あの…", ko: "아니, 그게…" },
  { ja: "へ？", ko: "에?" },
  { ja: "…？", ko: "…?" },
  { ja: "ん？", ko: "응?" },
];

/** 두 번 틀렸을 때 손님이 요구를 직접 말하는 힌트 (질문 종류별) */
export const konbiniHints: Partial<Record<QuestionKind, CustomerReply>> = {
  AGE_CHECK: { ja: "年齢確認、押せばいい？", ko: "연령 확인, 누르면 돼요?" },
  POINT_CARD: { ja: "ポイントカード、あるんだけど", ko: "포인트 카드 있는데요" },
  WARM: { ja: "温めてほしいんだけど", ko: "데워 주면 좋겠는데" },
  SEPARATE_BAG: { ja: "アイス、別の袋にして", ko: "아이스는 다른 봉투에 넣어 줘요" },
  BAG: { ja: "袋、ください", ko: "봉투 주세요" },
  CHOPSTICKS: { ja: "お箸つけて", ko: "젓가락 넣어 줘요" },
  SPOON: { ja: "スプーン、ある？", ko: "스푼 있어요?" },
  STRAW: { ja: "ストロー、ある？", ko: "빨대 있어요?" },
  TOTAL: { ja: "いくら？", ko: "얼마예요?" },
  PAY: { ja: "カードで", ko: "카드로요" },
  CAUTION_HOT: { ja: "熱い？", ko: "뜨거워요?" },
};

/** 손님 이탈 시 대사 */
export const konbiniLeaveReplies: CustomerReply[] = [
  { ja: "もういいです", ko: "됐어요" },
  { ja: "急いでるんで", ko: "급해서요" },
  { ja: "他の店行くわ", ko: "다른 가게 갈게요" },
  { ja: "……また来ます", ko: "…또 올게요" },
];
