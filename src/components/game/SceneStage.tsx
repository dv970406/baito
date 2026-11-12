"use client";

/**
 * 매장 씬 — 뒷 선반(+ 시즌 포스터 · 담배 선반) · 짜증 게이지 · 손님(아바타+말풍선) · 카운터 위 상품 또는 돌발 이벤트 표지.
 * scene-* 토큰은 여기서만 쓴다. 연출 단계(enter/reply/leave)에서는 씬을 탭해 넘길 수 있다.
 *
 * 손님 수식어: 취객(drunk)은 말풍선이 흔들리고 「酔」 칩, 관광객(tourist)은 영어 대사 + 「EN」 칩.
 * 길 묻기(DIRECTIONS)는 「駅」 표지판이 정답 방향을 가리킨다 — 보이는 단서가 있어야 맞힐 수 있다.
 */
import type {
  CustomerMood,
  CustomerReply,
  Direction,
  EventKind,
  Item,
  PaymentMethod,
  Regular,
  RegularVisual,
  Season,
  SpeedGrade,
} from "@/engine/types";
import { Avatar, Badge, Icon, IrritationGauge, ItemSprite, KanjiBadge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CustomerBubble } from "./CustomerBubble";
import { DIRECTION_LABEL, EVENT_KANJI, GRADE_LABEL, PAYMENT_LABEL, TAG_KANJI } from "./shiftModel";

export interface GradeFlash {
  grade: SpeedGrade;
  combo: number;
  /** 같은 등급이 연속으로 나와도 다시 그리도록 구분하는 키 */
  key: number;
}

export interface SceneStageProps {
  customerName: string;
  regular?: Regular;
  visual: Partial<RegularVisual>;
  mood: CustomerMood;
  bubble: CustomerReply | null;
  irritation: number;
  patienceMax: number;
  items: Item[];
  /** 결제 단계 — 손님이 내민 결제 수단을 보여준다 */
  payment: PaymentMethod | null;
  gradeFlash: GradeFlash | null;
  /** 연출 단계라 탭으로 넘길 수 있는가 */
  skippable: boolean;
  onSkip: () => void;
  /** 손님이 없는 순간(마감 직전) */
  empty?: boolean;
  /** 돌발 이벤트 손님이면 그 종류 — 상품 대신 표지를 보여준다 */
  event?: EventKind | null;
  /** 길 묻기의 정답 방향 — 「駅」 표지판이 가리킨다 */
  direction?: Direction | null;
  /** 취객 — 말풍선 흔들림 + 「酔」 칩 */
  drunk?: boolean;
  /** 관광객 — 영어 대사(lang="en") + 「EN」 칩 */
  tourist?: boolean;
  /** 이번 달 시즌 — 뒷벽 포스터 */
  season?: Season | null;
  /** 뒷벽 담배 선반에 보일 번호들. 비어 있으면 선반을 그리지 않는다 */
  tobaccoShelf?: string[];
  className?: string;
}

/** 뒷 선반 상품 색 — 디자인의 파스텔 5색(씬 전용 hex) */
const SHELF_COLORS = ["#D9E4F7", "#F7E3D9", "#E3F1DC", "#F7F0C9", "#E8DDF5"] as const;
const SHELF_ROWS: readonly (readonly string[])[] = [
  SHELF_COLORS,
  [SHELF_COLORS[3], SHELF_COLORS[0], SHELF_COLORS[4], SHELF_COLORS[1], SHELF_COLORS[2]],
];

const GRADE_CLASS: Record<SpeedGrade, string> = {
  perfect: "bg-perfect-soft text-perfect-ink",
  good: "bg-perfect-soft text-perfect-ink",
  ok: "bg-surface-raised text-ink",
  late: "bg-combo-soft text-combo",
};

const TAG_TONE: Record<string, "accent" | "combo" | "muted" | "shell"> = {
  hot: "combo",
  fragile_hot: "combo",
  cold: "accent",
  alcohol: "shell",
  tobacco: "shell",
};

export function SceneStage({
  customerName,
  regular,
  visual,
  mood,
  bubble,
  irritation,
  patienceMax,
  items,
  payment,
  gradeFlash,
  skippable,
  onSkip,
  empty = false,
  event = null,
  direction = null,
  drunk = false,
  tourist = false,
  season = null,
  tobaccoShelf = [],
  className,
}: SceneStageProps) {
  return (
    <section
      aria-label="매장"
      onClick={skippable ? onSkip : undefined}
      className={cn("relative min-h-[280px] shrink-0 overflow-hidden select-none", className)}
    >
      {/* 뒷 선반 */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-[48%] flex-col justify-around bg-surface-sunken py-2.5">
        {SHELF_ROWS.map((row, r) => (
          <div key={r} className="flex flex-col gap-2">
            <div className="flex gap-2.5 px-4">
              {row.map((color, i) => (
                <span key={i} className="h-[38px] flex-1 rounded-sm opacity-90" style={{ background: color }} />
              ))}
            </div>
            <span className="mx-2 h-[3px] bg-border-strong" />
          </div>
        ))}
      </div>

      {/* 뒷벽 오른쪽 아래(말풍선 아래, 카운터 위): 시즌 포스터(세로 종이) */}
      {season ? <SeasonPoster season={season} /> : null}

      {/* 뒷벽 왼쪽: 담배 선반 — 번호 칩. 손님이 말한 번호는 여기에 없다(귀로만 듣는다) */}
      {tobaccoShelf.length > 0 ? <TobaccoShelf numbers={tobaccoShelf} /> : null}

      {/* 왼쪽 위: 단골 배지 · 손님 수식어 · 결제 수단 */}
      <div className="absolute left-4 top-3 flex items-center gap-1.5">
        {regular ? (
          <Badge tone="accent" size="md">
            常連 · {regular.nameJa}
          </Badge>
        ) : null}
        {drunk ? (
          <Badge tone="combo" size="md" aria-label="취객">
            酔
          </Badge>
        ) : null}
        {tourist ? (
          <Badge tone="shell" size="md" aria-label="외국인 관광객 · 영어로 말해요">
            EN
          </Badge>
        ) : null}
        {payment ? (
          <Badge tone="shell" size="md" aria-label={`결제 수단 ${PAYMENT_LABEL[payment].ko}`}>
            <Icon name={PAYMENT_LABEL[payment].icon} size={14} className="mr-1" />
            {PAYMENT_LABEL[payment].ja}
          </Badge>
        ) : null}
      </div>

      {/* 오른쪽 위: 속도 등급 플래시 */}
      <div className="absolute right-4 top-3 min-h-7" role="status" aria-live="polite">
        {gradeFlash ? (
          <span
            key={gradeFlash.key}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1.5 font-num text-label font-extrabold shadow-hairline",
              "transition-opacity duration-200 motion-reduce:transition-none",
              GRADE_CLASS[gradeFlash.grade],
            )}
          >
            {GRADE_LABEL[gradeFlash.grade]}
            {gradeFlash.combo >= 2 ? <span aria-label={`콤보 ${gradeFlash.combo}`}>×{gradeFlash.combo}</span> : null}
          </span>
        ) : null}
      </div>

      {!empty ? (
        <>
          {/* 짜증 게이지 */}
          <IrritationGauge
            value={irritation}
            max={patienceMax}
            className="absolute bottom-[278px] left-1/2 -translate-x-1/2"
          />

          {/* 손님 — 위치는 래퍼가, 퇴장 연출(옆으로 밀리며 흐려짐)은 아바타가 맡는다 */}
          <div className="absolute bottom-[114px] left-1/2 -translate-x-1/2">
            <Avatar
              name={customerName}
              mood={mood}
              visual={visual}
              size="scene"
              body
              className={cn(
                "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                mood === "gone" && "translate-x-10 opacity-40",
              )}
            />
          </div>

          {/* 말풍선 — 머리 오른쪽, 화면 오른쪽 여백 12px 까지 */}
          <CustomerBubble
            ja={bubble?.ja ?? ""}
            ko={bubble?.ko}
            lang={tourist ? "en" : "ja"}
            drunk={drunk}
            className="absolute left-[calc(50%+41px)] right-3 top-[calc(100%-284px)]"
          />
        </>
      ) : null}

      {/* 카운터 */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-2.5 bottom-0 h-[118px] rounded-t-3xl border-t-[6px] border-scene-counter-edge bg-scene-counter"
      />

      {/* 카운터 위: 상품, 또는 돌발 이벤트 표지 */}
      {event && !empty ? (
        <EventSign event={event} direction={direction} />
      ) : (
        <ul aria-label="카운터 위 상품" className="absolute inset-x-0 bottom-[30px] m-0 flex list-none justify-center gap-3.5 p-0">
          {items.map((item, i) => (
            <li key={`${item.id}-${i}`} className="flex flex-col items-center gap-1">
              <div className="flex min-h-[18px] items-center gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} tone={TAG_TONE[tag] ?? "muted"} size="sm" aria-label={TAG_KANJI[tag].ko}>
                    {TAG_KANJI[tag].kanji}
                  </Badge>
                ))}
              </div>
              <ItemSprite visual={item.visual} name={item.ja} size="md" />
            </li>
          ))}
        </ul>
      )}

      {/* 연출 넘기기 */}
      {skippable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSkip();
          }}
          className="absolute bottom-2 right-3 inline-flex min-h-touch items-center gap-1 rounded-pill px-3 font-jp text-label text-ink-muted"
        >
          タップで次へ
          <Icon name="chevronRight" size={14} />
        </button>
      ) : null}
    </section>
  );
}

/* ───────────────────────── 뒷벽 장식 ───────────────────────── */

/** 시즌 포스터 — 세로쓰기 작은 종이. 선반 위 오른쪽 벽에 붙어 있다 */
/** 포스터 종이에 들어가는 최대 글자 수(세로 2열) */
const POSTER_MAX_CHARS = 14;

/**
 * 시즌 포스터 머리말 — 「A ─ B」 의 A, 띄어쓰기 앞, 그래도 길면 「・」 앞.
 * 작은 세로 종이에 전체 문장은 들어가지 않으므로 첫 마디만 크게 붙인다(전체는 aria-label).
 */
export function posterHeadline(posterJa: string): string {
  let head = posterJa.split(/\s*─\s*/)[0].trim();
  head = head.split(/\s+/)[0];
  if (head.length > POSTER_MAX_CHARS) head = head.split("・")[0];
  return head.length > POSTER_MAX_CHARS ? head.slice(0, POSTER_MAX_CHARS) : head;
}

function SeasonPoster({ season }: { season: Season }) {
  return (
    <div
      role="img"
      aria-label={`매장 포스터 · ${season.nameKo} · ${season.posterJa}`}
      data-poster
      className="absolute bottom-[124px] right-3 flex h-[64px] max-w-[52px] items-start justify-center overflow-hidden rounded-xs bg-surface-raised px-1 py-1 shadow-hairline"
    >
      <span
        lang="ja"
        aria-hidden="true"
        className="block max-h-full font-jp text-micro font-bold leading-[1.2] text-ink"
        style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
      >
        {posterHeadline(season.posterJa)}
      </span>
    </div>
  );
}

/** 담배 선반 — 왼쪽 벽, 번호 칩 몇 개. 상품은 안 보이고 번호만 보인다(실제 편의점처럼) */
function TobaccoShelf({ numbers }: { numbers: string[] }) {
  return (
    <div
      role="img"
      aria-label="담배 선반"
      data-tobacco-shelf
      className="absolute left-3 top-2 flex h-[76px] w-[62px] flex-col justify-between rounded-xs bg-shell px-1.5 py-1.5"
    >
      <span className="font-jp text-micro font-bold leading-none text-shell-muted">たばこ</span>
      <div className="grid grid-cols-3 gap-0.5">
        {numbers.map((n) => (
          <span
            key={n}
            className="inline-flex h-3.5 items-center justify-center rounded-xs bg-shell-raised font-num text-[8px] font-extrabold leading-none text-shell-ink"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 돌발 이벤트 표지 ───────────────────────── */

/**
 * 카운터 위 표지. 길 묻기는 「駅」 + 방향 화살표(지도 느낌의 작은 표지판), 그 밖의 이벤트는 한자 1~2자 배지.
 */
function EventSign({ event, direction }: { event: EventKind; direction: Direction | null }) {
  if (event === "DIRECTIONS") {
    const dir = direction ? DIRECTION_LABEL[direction] : null;
    return (
      <div
        role="img"
        aria-label={dir ? `역은 ${dir.ko}` : "역 방향 표지"}
        data-event="DIRECTIONS"
        data-direction={direction ?? undefined}
        className="absolute inset-x-0 bottom-[34px] flex justify-center"
      >
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-3 py-2 shadow-hairline">
          <KanjiBadge kanji="駅" tone="accent" label="역" />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent-soft text-accent">
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: `rotate(${dir?.rotate ?? 0}deg)` }}
            >
              <path d="M12 20V4M5 11l7-7 7 7" />
            </svg>
          </span>
          {dir ? (
            <span className="flex flex-col leading-none">
              <span lang="ja" className="font-jp text-caption font-bold text-ink">
                {dir.ja}
              </span>
              <span className="font-ko text-micro text-ink-muted">{dir.ko}</span>
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const label = EVENT_KANJI[event];
  return (
    <div
      role="img"
      aria-label={`${label.ko} 손님`}
      data-event={event}
      className="absolute inset-x-0 bottom-[34px] flex justify-center"
    >
      <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised px-3 py-2 shadow-hairline">
        <KanjiBadge kanji={label.kanji} tone="sunken" size="lg" className={cn(label.kanji.length > 1 && "text-[13px]")} />
        <span className="flex flex-col leading-none">
          <span lang="ja" className="font-jp text-caption font-bold text-ink">
            {label.ja}
          </span>
          <span className="font-ko text-micro text-ink-muted">{label.ko}</span>
        </span>
      </div>
    </div>
  );
}
