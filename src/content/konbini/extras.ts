import type { CustomerReply, DrunkReplies, EventKind, ListenTarget, ListenTargetLabel, Season } from "@/engine/types";

/**
 * KONBINI 추가 콘텐츠 — 리스닝 단계 요구, 돌발 이벤트 첫마디, 담배 번호 요구, 시즌.
 * en 이 있는 대사는 외국인 관광객이 영어로 말한다.
 */

/** LISTEN: 손님이 먼저 요구를 말한다 (플레이어는 아이콘으로 반응) */
export const konbiniListenRequests: Partial<Record<ListenTarget, CustomerReply[]>> = {
  WARM: [
    { ja: "これ、温めて", ko: "이거 데워 줘요", en: "Can you heat this up?" },
    { ja: "温めお願い", ko: "데우기 부탁해요", en: "Heat it up, please." },
    { ja: "あっためてもらえる？", ko: "데워 줄 수 있어요?", en: "Could you warm it up?" },
    { ja: "弁当、チンして", ko: "도시락, 돌려 줘요", en: "Microwave the bento, please." },
    { ja: "熱くして", ko: "뜨겁게 해 줘요", en: "Make it hot." },
    { ja: "これだけ温めて", ko: "이것만 데워 줘요", en: "Just heat this one." },
  ],
  BAG: [
    { ja: "袋ください", ko: "봉투 주세요", en: "A bag, please." },
    { ja: "袋、一枚", ko: "봉투 한 장이요", en: "One bag, please." },
    { ja: "袋に入れて", ko: "봉투에 넣어 줘요", en: "Can I get a bag?" },
    { ja: "袋、お願い", ko: "봉투 부탁해요", en: "Bag, please." },
    { ja: "レジ袋もらえる？", ko: "비닐봉투 받을 수 있어요?", en: "Could I have a plastic bag?" },
    { ja: "持てないから袋", ko: "못 들어서 봉투요", en: "I can't carry it, so a bag." },
  ],
  CHOPSTICKS: [
    { ja: "お箸つけて", ko: "젓가락 넣어 줘요", en: "Chopsticks, please." },
    { ja: "箸、一つ", ko: "젓가락 하나요", en: "One pair of chopsticks." },
    { ja: "お箸ください", ko: "젓가락 주세요", en: "Can I have chopsticks?" },
    { ja: "箸、二つもらえる？", ko: "젓가락 두 개 받을 수 있어요?", en: "Could I get two pairs?" },
    { ja: "お箸、お願い", ko: "젓가락 부탁해요", en: "Some chopsticks, please." },
    { ja: "箸いる", ko: "젓가락 필요해요", en: "I need chopsticks." },
  ],
  SPOON: [
    { ja: "スプーンつけて", ko: "스푼 넣어 줘요", en: "A spoon, please." },
    { ja: "スプーンある？", ko: "스푼 있어요?", en: "Do you have a spoon?" },
    { ja: "スプーンください", ko: "스푼 주세요", en: "Spoon, please." },
    { ja: "スプーン、一本", ko: "스푼 하나요", en: "One spoon." },
    { ja: "スプーンもらえる？", ko: "스푼 받을 수 있어요?", en: "Could I have a spoon?" },
    { ja: "食べるの、スプーンで", ko: "스푼으로 먹을 거라", en: "I'll eat it with a spoon." },
  ],
  STRAW: [
    { ja: "ストローつけて", ko: "빨대 넣어 줘요", en: "A straw, please." },
    { ja: "ストロー、一本", ko: "빨대 하나요", en: "One straw, please." },
    { ja: "ストローください", ko: "빨대 주세요", en: "Can I get a straw?" },
    { ja: "ストローある？", ko: "빨대 있어요?", en: "Do you have straws?" },
    { ja: "ストロー、お願い", ko: "빨대 부탁해요", en: "Straw, please." },
    { ja: "これ、ストローで飲むから", ko: "이거 빨대로 마실 거라", en: "I'll drink this with a straw." },
  ],
};

/** LISTEN 선택지(아이콘) 라벨 */
export const konbiniListenTargets: Record<ListenTarget, ListenTargetLabel> = {
  WARM: { ja: "温める", ko: "데우기", en: "Heat", icon: "warm" },
  BAG: { ja: "袋", ko: "봉투", en: "Bag", icon: "bag" },
  CHOPSTICKS: { ja: "お箸", ko: "젓가락", en: "Chopsticks", icon: "chopsticks" },
  SPOON: { ja: "スプーン", ko: "스푼", en: "Spoon", icon: "spoon" },
  STRAW: { ja: "ストロー", ko: "빨대", en: "Straw", icon: "straw" },
};

/** 돌발 이벤트 손님의 첫마디 */
export const konbiniEventPrompts: Record<EventKind, CustomerReply[]> = {
  DIRECTIONS: [
    { ja: "すみません、駅はどっちですか？", ko: "저기요, 역은 어느 쪽이에요?", en: "Excuse me, which way is the station?" },
    { ja: "駅に行きたいんですけど", ko: "역에 가고 싶은데요", en: "I'm trying to get to the station." },
    { ja: "ここから駅、近いですか？", ko: "여기서 역, 가까워요?", en: "Is the station near here?" },
    { ja: "道、聞いていいですか。駅なんですけど", ko: "길 좀 물어도 돼요? 역인데요", en: "Can I ask for directions? To the station." },
    { ja: "迷っちゃって。駅、どっち？", ko: "길을 잃어서. 역, 어느 쪽?", en: "I got lost. Which way's the station?" },
  ],
  TOILET: [
    { ja: "トイレ、借りられます？", ko: "화장실 좀 쓸 수 있어요?", en: "Can I use the restroom?" },
    { ja: "お手洗いはどこですか？", ko: "화장실은 어디예요?", en: "Where is the restroom?" },
    { ja: "すみません、トイレどこ？", ko: "저기요, 화장실 어디?", en: "Sorry, where's the toilet?" },
    { ja: "トイレ、ありますか", ko: "화장실, 있어요?", en: "Do you have a restroom?" },
    { ja: "急いでて、トイレ……", ko: "급해서, 화장실…", en: "It's urgent, the restroom..." },
  ],
  COPIER: [
    { ja: "コピー機、動かないんですけど", ko: "복사기가 안 되는데요", en: "The copier isn't working." },
    { ja: "コピー機が紙詰まりで…", ko: "복사기가 종이 걸림이라…", en: "The copier is jammed..." },
    { ja: "コピー、お金入れたのに出ない", ko: "복사, 돈 넣었는데 안 나와요", en: "I paid but the copy won't come out." },
    { ja: "コピー機の使い方、分からなくて", ko: "복사기 사용법을 몰라서요", en: "I don't know how to use the copier." },
    { ja: "両面コピー、どうやるの？", ko: "양면 복사, 어떻게 해요?", en: "How do I copy double-sided?" },
  ],
  ATM: [
    { ja: "ATMの使い方、教えてもらえます？", ko: "ATM 사용법 좀 알려 줄래요?", en: "Could you show me how to use the ATM?" },
    { ja: "ATMで引き出したいんですけど", ko: "ATM에서 출금하고 싶은데요", en: "I'd like to withdraw cash from the ATM." },
    { ja: "ATM、どこですか？", ko: "ATM, 어디예요?", en: "Where's the ATM?" },
    { ja: "海外のカード、ATMで使えます？", ko: "해외 카드, ATM에서 쓸 수 있어요?", en: "Can I use a foreign card at the ATM?" },
    { ja: "ATMがカードを返してくれない", ko: "ATM이 카드를 안 돌려줘요", en: "The ATM won't give my card back." },
  ],
  DELIVERY: [
    { ja: "これ、宅配で送りたいんですけど", ko: "이거 택배로 보내고 싶은데요", en: "I'd like to ship this package." },
    { ja: "荷物、ここから出せます？", ko: "짐, 여기서 보낼 수 있어요?", en: "Can I send a parcel from here?" },
    { ja: "宅配便、お願いします", ko: "택배, 부탁해요", en: "I'd like to send a parcel." },
    { ja: "これ、北海道まで送れる？", ko: "이거 홋카이도까지 보낼 수 있어요?", en: "Can I send this to Hokkaido?" },
    { ja: "伝票、どこにあります？", ko: "송장, 어디 있어요?", en: "Where are the shipping forms?" },
  ],
  UTILITY_BILL: [
    { ja: "電気代、ここで払えます？", ko: "전기 요금, 여기서 낼 수 있어요?", en: "Can I pay my electricity bill here?" },
    { ja: "この払込票、お願いします", ko: "이 납부서 부탁해요", en: "I'd like to pay this bill." },
    { ja: "ガス代、払いたいんですけど", ko: "가스 요금 내고 싶은데요", en: "I want to pay my gas bill." },
    { ja: "水道代の支払い、できますか", ko: "수도 요금 납부, 돼요?", en: "Can I pay my water bill?" },
    { ja: "これ、期限今日なんです。払えます？", ko: "이거 기한이 오늘이에요. 낼 수 있어요?", en: "This is due today. Can I pay it?" },
  ],
  TICKET: [
    { ja: "ライブのチケット、ここで取れます？", ko: "공연 티켓, 여기서 뽑을 수 있어요?", en: "Can I pick up concert tickets here?" },
    { ja: "予約番号あるんですけど、チケット…", ko: "예약 번호는 있는데, 티켓이…", en: "I have a booking number for tickets..." },
    { ja: "映画のチケット、発券したいんですけど", ko: "영화 티켓 발권하고 싶은데요", en: "I'd like to print my movie tickets." },
    { ja: "チケット、どこで出すの？", ko: "티켓, 어디서 뽑아요?", en: "Where do I get my tickets?" },
    { ja: "高速バスの券、ここで買えます？", ko: "고속버스 표, 여기서 살 수 있어요?", en: "Can I buy highway bus tickets here?" },
  ],
};

/** 담배 번호 요구 — {n} 에 선반 번호 */
export const konbiniTobaccoRequests: CustomerReply[] = [
  { ja: "{n}番お願いします", ko: "{n}번 주세요", en: "Number {n}, please." },
  { ja: "{n}番、一つ", ko: "{n}번 하나요", en: "One pack of number {n}." },
  { ja: "えっと、{n}番", ko: "어, {n}번이요", en: "Umm, number {n}." },
  { ja: "{n}番を二つ。いや、一つで", ko: "{n}번 두 개. 아니, 하나로", en: "Two of number {n}. No, just one." },
  { ja: "タバコ、{n}番", ko: "담배, {n}번", en: "Cigarettes, number {n}." },
  { ja: "いつもの{n}番", ko: "늘 사는 {n}번", en: "My usual, number {n}." },
  { ja: "{n}番と、ライター", ko: "{n}번이랑 라이터", en: "Number {n} and a lighter." },
];

/**
 * 월별 시즌 — 포스터는 매장 뒷벽, 규칙 변경이 있는 달은 점장 공지가 홈·출근 시트에 뜬다.
 * 규칙 변경: 1월(포인트 2배 → 전원 포인트카드), 4월(새 학기 경비정산 → 영수증 확인),
 *           7월(에코 월간 → 봉투 사이즈 확인), 10월(포인트 축제 → 전원 포인트카드), 12월(연말 대량 구매 → 봉투 사이즈 확인)
 */
export const konbiniSeasons: Season[] = [
  {
    month: 1,
    nameJa: "お正月",
    nameKo: "정월",
    nameEn: "New Year",
    posterJa: "新春ポイント2倍！ お雑煮セット、甘酒あります",
    noticeJa: "今月はポイント2倍キャンペーン。全員にポイントカードを聞け。例外なし。",
    noticeKo: "이번 달은 포인트 2배 캠페인. 모든 손님에게 포인트카드를 물어라. 예외 없다.",
    noticeEn: "Double points all month. Ask everyone for their point card. No exceptions.",
    rule: { kind: "pointCardAlways" },
  },
  {
    month: 2,
    nameJa: "節分・バレンタイン",
    nameKo: "세츠분·발렌타인",
    nameEn: "Setsubun & Valentine's",
    posterJa: "恵方巻ご予約受付中 ─ 今年の恵方は南南東",
  },
  {
    month: 3,
    nameJa: "ひな祭り・卒業",
    nameKo: "히나마츠리·졸업",
    nameEn: "Hinamatsuri & Graduation",
    posterJa: "桜もち・ひなあられ入荷 ─ 春はもうすぐ",
  },
  {
    month: 4,
    nameJa: "新生活",
    nameKo: "새 학기",
    nameEn: "Fresh Start",
    posterJa: "新生活応援！ お花見弁当・桜ラテ 期間限定",
    noticeJa: "今月から会計後にレシートが要るか聞く。新社会人は経費精算で欲しがる。",
    noticeKo: "이번 달부터 계산 뒤 영수증이 필요한지 묻는다. 새 사회인은 경비 정산 때문에 찾는다.",
    noticeEn: "From this month, ask if they want a receipt after paying. New hires want them for expenses.",
    rule: { kind: "receiptAsk" },
  },
  {
    month: 5,
    nameJa: "端午の節句",
    nameKo: "단오",
    nameEn: "Children's Day",
    posterJa: "柏餅・ちまき 本日入荷 ─ こどもの日",
  },
  {
    month: 6,
    nameJa: "梅雨",
    nameKo: "장마",
    nameEn: "Rainy Season",
    posterJa: "水ようかん・梅ソーダで涼を ─ 傘、レジ横にあります",
  },
  {
    month: 7,
    nameJa: "夏本番",
    nameKo: "한여름",
    nameEn: "Midsummer",
    posterJa: "土用の丑の日 うなぎ弁当 ─ 冷やし中華はじめました",
    noticeJa: "今月はエコ月間。袋を聞いたら、次はサイズも聞く。大・中・小だ。",
    noticeKo: "이번 달은 에코 월간. 봉투를 물었으면 다음은 사이즈도 묻는다. 대·중·소다.",
    noticeEn: "Eco month. After asking about a bag, ask the size too. Large, medium, small.",
    rule: { kind: "bagSize" },
  },
  {
    month: 8,
    nameJa: "夏祭り",
    nameKo: "여름 축제",
    nameEn: "Summer Festival",
    posterJa: "花火セット・ラムネ・かき氷 ─ 夏祭り応援セール",
  },
  {
    month: 9,
    nameJa: "お月見",
    nameKo: "달맞이",
    nameEn: "Moon Viewing",
    posterJa: "月見団子・栗ごはんおにぎり ─ 秋の味、入荷",
  },
  {
    month: 10,
    nameJa: "ハロウィン",
    nameKo: "할로윈",
    nameEn: "Halloween",
    posterJa: "ハロウィンスナック・パンプキンプリン ─ ポイント祭り開催",
    noticeJa: "今月はポイント祭り。ポイントカードは全員に聞く。仮装してても聞く。",
    noticeKo: "이번 달은 포인트 축제. 포인트카드는 모든 손님에게 묻는다. 코스튬을 입었어도 묻는다.",
    noticeEn: "Points festival this month. Ask everyone for their point card. Even in costume.",
    rule: { kind: "pointCardAlways" },
  },
  {
    month: 11,
    nameJa: "おでんの季節",
    nameKo: "오뎅의 계절",
    nameEn: "Oden Season",
    posterJa: "おでん増量！ 餅巾着入荷 ─ 特大肉まん、始めました",
  },
  {
    month: 12,
    nameJa: "クリスマス・年末",
    nameKo: "크리스마스·연말",
    nameEn: "Christmas & Year-End",
    posterJa: "クリスマスチキン予約受付中 ─ 年越しそば 12/31 まで",
    noticeJa: "年末は買い込みが増える。袋のあとにサイズを聞く。今月だけだ。",
    noticeKo: "연말엔 대량 구매가 늘어난다. 봉투 뒤에 사이즈를 묻는다. 이번 달만이다.",
    noticeEn: "Year-end means bulk buying. Ask the size after the bag. This month only.",
    rule: { kind: "bagSize" },
  },
];

/**
 * 취객(심야) 전용 대사 — 혀가 꼬이고 길게 늘어진다.
 * 정답 뒤 반응은 절반쯤만 이 대사로 바뀌고(나머지는 원래 응답), 당황·이탈은 항상 이 대사.
 */
export const konbiniDrunkReplies: DrunkReplies = {
  reply: [
    { ja: "おぉ〜…それそれぇ", ko: "오오~… 그거 그거~", en: "Ohhh... thaaat one" },
    { ja: "いいよいいよぉ〜", ko: "좋아 좋아~", en: "Gooood, gooood" },
    { ja: "にーちゃん、わかってるねぇ", ko: "형씨, 뭘 좀 아네~", en: "Buddy, you get it, huhh" },
    { ja: "うぃ〜…たのむわ", ko: "으이~… 부탁해", en: "Yeahhh... I'm countin' on ya" },
    { ja: "はいはい〜、それでぇ", ko: "네네~ 그걸로~", en: "Yeah yeahhh, that'll do" },
    { ja: "んふふ、さいこぉ", ko: "흐흐, 최고~", en: "Hehe, perfecttt" },
    { ja: "まかせたぁ〜", ko: "맡긴다~", en: "Leavin' it to youuu" },
    { ja: "それなぁ〜…それ", ko: "그거지~… 그거", en: "Riiight... that one" },
  ],
  confused: [
    { ja: "あぁ？ なんてぇ？", ko: "어? 뭐라고~?", en: "Huh? Whaddya say?" },
    { ja: "ん〜？ もっかい言ってぇ", ko: "응~? 한 번 더 말해 줘~", en: "Hmm? Say it againnn" },
    { ja: "ちがうちがう〜、ちがうってぇ", ko: "아니 아니~ 아니라니까~", en: "Nooo, nooo, I said nooo" },
    { ja: "へ？ おれ、なんか言ったっけ", ko: "에? 나 뭐라 했었나", en: "Huh? Did I say somethin'?" },
    { ja: "むずかしいこと言うなよぉ", ko: "어려운 말 하지 마~", en: "Don't say hard stuff to meee" },
    { ja: "うぃっく…なに？", ko: "딸꾹… 뭐?", en: "*hic*... what?" },
  ],
  leave: [
    { ja: "もういいわ〜…よそで買うぅ", ko: "됐어~… 딴 데서 살래~", en: "Forget it... I'll buy somewhere elsse" },
    { ja: "なんだよぉ…帰るわ", ko: "뭐야~… 간다", en: "Whatever... I'm goin' home" },
    { ja: "おれ、寝るぅ〜", ko: "나 잘래~", en: "I'm gonna sleeeep" },
    { ja: "つめてぇなぁ〜、この店", ko: "차갑네~ 이 가게", en: "So cold, this placcce" },
  ],
};
