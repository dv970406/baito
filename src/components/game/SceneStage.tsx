"use client";

/**
 * 매장 씬 — 뒷 선반 · 짜증 게이지 · 손님(아바타+말풍선) · 카운터 위 상품.
 * scene-* 토큰은 여기서만 쓴다. 연출 단계(enter/reply/leave)에서는 씬을 탭해 넘길 수 있다.
 */
import type { CustomerMood, CustomerReply, Item, PaymentMethod, Regular, RegularVisual, SpeedGrade } from "@/engine/types";
import { Avatar, Badge, Icon, IrritationGauge, ItemSprite, SpeechBubble } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GRADE_LABEL, PAYMENT_LABEL, TAG_KANJI } from "./shiftModel";

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

      {/* 왼쪽 위: 단골 배지 · 결제 수단 */}
      <div className="absolute left-4 top-3 flex items-center gap-1.5">
        {regular ? (
          <Badge tone="accent" size="md">
            常連 · {regular.nameJa}
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
          <SpeechBubble
            ja={bubble?.ja ?? ""}
            ko={bubble?.ko}
            className="absolute left-[calc(50%+41px)] right-3 top-[calc(100%-284px)]"
          />
        </>
      ) : null}

      {/* 카운터 */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-2.5 bottom-0 h-[118px] rounded-t-3xl border-t-[6px] border-scene-counter-edge bg-scene-counter"
      />

      {/* 카운터 위 상품 */}
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
