import type { CSSProperties } from "react";
import type { CustomerMood, HairStyle, RegularVisual } from "@/engine/types";
import { cn } from "@/lib/cn";

export type AvatarSize = "sm" | "md" | "lg" | "scene";

export interface AvatarProps {
  /** 손님 이름 (aria-label 에 쓰인다) */
  name: string;
  mood?: CustomerMood;
  /** 레귤러 외형. 없는 값은 익명 손님 기본값(검은 짧은 머리·네이비 상의)으로 채운다 */
  visual?: Partial<RegularVisual>;
  /** sm 40 · md 44 · lg 56 · scene 74(머리) + 150×90 몸통 */
  size?: AvatarSize;
  /** 어깨/상의 블록을 함께 그린다 */
  body?: boolean;
  /** 포인트 색(visual.accent)을 넥타이로 그릴지 앞치마로 그릴지 */
  accentKind?: "tie" | "apron";
  className?: string;
}

const MOOD_KO: Record<CustomerMood, string> = {
  neutral: "보통",
  happy: "기분 좋음",
  confused: "당황",
  annoyed: "짜증",
  gone: "떠남",
};

const DEFAULT_HAIR_COLOR = "#2B2A33";
const DEFAULT_OUTFIT = "#2E3A59";

/** 사이즈별 고정 px 값(퍼센트로 못 쓰는 테두리·몸통 치수) */
const SIZE_CFG: Record<
  AvatarSize,
  { head: string; stroke: string; hairBottom: string; body: string; bodyRadius: string }
> = {
  sm: { head: "size-avatar-sm", stroke: "border-2", hairBottom: "rounded-b-xs", body: "w-[82px] h-12 -mt-1", bodyRadius: "rounded-t-[22px]" },
  md: { head: "size-avatar", stroke: "border-2", hairBottom: "rounded-b-xs", body: "w-[90px] h-[54px] -mt-1", bodyRadius: "rounded-t-[24px]" },
  lg: { head: "size-avatar-lg", stroke: "border-[2.5px]", hairBottom: "rounded-b-sm", body: "w-[114px] h-[68px] -mt-1", bodyRadius: "rounded-t-[30px]" },
  scene: { head: "size-avatar-scene", stroke: "border-[3px]", hairBottom: "rounded-b-md", body: "w-[150px] h-[90px] -mt-1.5", bodyRadius: "rounded-t-[40px]" },
};

/**
 * 머리 모양. 디자인(田中)의 74px 기준 수치를 퍼센트로 환산했다:
 * 머리카락 블록 left/right 4 · height 30 → 5.4% / 40.5%
 */
function Hair({ style, color, bottom }: { style: HairStyle; color: string; bottom: string }) {
  const bg: CSSProperties = { background: color };
  const block = <span className={cn("absolute inset-x-[5.4%] top-0 h-[40.5%] rounded-t-full", bottom)} style={bg} />;
  switch (style) {
    case "bald":
      return null;
    case "short":
      return block;
    case "long":
      return (
        <>
          {block}
          <span className="absolute left-0 top-[22%] h-[70%] w-[17%] rounded-b-lg" style={bg} />
          <span className="absolute right-0 top-[22%] h-[70%] w-[17%] rounded-b-lg" style={bg} />
        </>
      );
    case "bun":
      return (
        <>
          {block}
          <span className="absolute -top-[14%] left-1/2 size-[30%] -translate-x-1/2 rounded-full" style={bg} />
        </>
      );
    case "ponytail":
      return (
        <>
          {block}
          <span className="absolute -right-[6%] top-[30%] h-[55%] w-[18%] rounded-pill" style={bg} />
        </>
      );
    case "mohawk":
      return <span className="absolute -top-[12%] left-1/2 h-[50%] w-[28%] -translate-x-1/2 rounded-t-full" style={bg} />;
    case "cap":
      return (
        <>
          <span className="absolute inset-x-[3%] top-0 h-[36%] rounded-t-full" style={bg} />
          <span className="absolute -left-[8%] right-[-8%] top-[30%] h-[10%] rounded-pill" style={bg} />
        </>
      );
    case "hat":
      return (
        <>
          <span className="absolute inset-x-[12%] -top-[10%] h-[30%] rounded-t-lg" style={bg} />
          <span className="absolute -left-[12%] right-[-12%] top-[16%] h-[9%] rounded-pill" style={bg} />
        </>
      );
    default:
      return block;
  }
}

/** 눈. gone 이면 감은 눈(가로선) */
function Eyes({ closed }: { closed: boolean }) {
  const cls = closed
    ? "absolute top-[54%] h-[max(2px,3%)] w-[12%] rounded-pill bg-shell"
    : "absolute top-[51%] size-[9.5%] rounded-full bg-shell";
  return (
    <>
      <span className={cn(cls, closed ? "left-[26%]" : "left-[29.7%]")} />
      <span className={cn(cls, closed ? "right-[26%]" : "right-[29.7%]")} />
    </>
  );
}

/** 입(+눈썹). 디자인 수치: neutral 30/52 14×3 · happy 27/48 20×10 · confused 32/50 10×10 */
function Mouth({ mood, stroke }: { mood: CustomerMood; stroke: string }) {
  switch (mood) {
    case "happy":
      return (
        <span
          className={cn("absolute left-[36.5%] top-[65%] h-[13.5%] w-[27%] rounded-b-full border-shell border-t-0", stroke)}
        />
      );
    case "confused":
      return <span className={cn("absolute left-[43%] top-[67.5%] size-[13.5%] rounded-full border-shell", stroke)} />;
    case "annoyed":
      return (
        <>
          <span className="absolute left-[25%] top-[42%] h-[max(2px,3.5%)] w-[15%] rotate-[18deg] rounded-pill bg-shell" />
          <span className="absolute right-[25%] top-[42%] h-[max(2px,3.5%)] w-[15%] -rotate-[18deg] rounded-pill bg-shell" />
          <span
            className={cn("absolute left-[36.5%] top-[70%] h-[12%] w-[27%] rounded-t-full border-shell border-b-0", stroke)}
          />
        </>
      );
    case "gone":
      return <span className="absolute left-[42%] top-[70%] h-[max(2px,4%)] w-[16%] rounded-sm bg-shell" />;
    case "neutral":
    default:
      return <span className="absolute left-[40.5%] top-[70%] h-[max(2px,4%)] w-[19%] rounded-sm bg-shell" />;
  }
}

/**
 * CSS 도형 손님 아바타. 머리 원(피부색) + 머리카락(hairStyle) + 눈 + 표정(mood),
 * 선택적으로 상의 블록(옷 색 + 흰 칼라 + 넥타이/앞치마).
 * 디자인의 田中 = 검은 짧은 머리 · 네이비(#2E3A59) 상의 · 빨간 넥타이.
 * 색은 씬 전용 hex 라 style 로 받는다. role="img" + "{이름} · {기분}".
 */
export function Avatar({ name, mood = "neutral", visual, size = "md", body = false, accentKind = "tie", className }: AvatarProps) {
  const cfg = SIZE_CFG[size];
  const hairStyle = visual?.hairStyle ?? "short";
  const hairColor = visual?.hairColor ?? DEFAULT_HAIR_COLOR;
  const outfit = visual?.outfit ?? DEFAULT_OUTFIT;
  const skinStyle: CSSProperties | undefined = visual?.skin ? { background: visual.skin } : undefined;
  const accent = visual?.accent;

  return (
    <div
      role="img"
      aria-label={`${name} · ${MOOD_KO[mood]}`}
      data-mood={mood}
      data-hair={hairStyle}
      className={cn("relative inline-flex flex-col items-center", className)}
    >
      <div className={cn("relative z-10", cfg.head)}>
        <span className={cn("absolute inset-0 rounded-full", !skinStyle && "bg-scene-skin")} style={skinStyle} />
        <Hair style={hairStyle} color={hairColor} bottom={cfg.hairBottom} />
        <Eyes closed={mood === "gone"} />
        <Mouth mood={mood} stroke={cfg.stroke} />
      </div>
      {body ? (
        <div className={cn("relative", cfg.body, cfg.bodyRadius)} style={{ background: outfit }}>
          <span className="absolute left-1/2 top-0 h-[67%] w-[23%] -translate-x-1/2 bg-surface-raised [clip-path:polygon(0_0,100%_0,60%_100%,40%_100%)]" />
          {accent && accentKind === "tie" ? (
            <span
              className="absolute left-1/2 top-[7%] h-[55%] w-[6.7%] -translate-x-1/2 [clip-path:polygon(20%_0,80%_0,100%_100%,0_100%)]"
              style={{ background: accent }}
            />
          ) : null}
          {accent && accentKind === "apron" ? (
            <span className="absolute inset-x-[25%] bottom-0 h-[58%] rounded-t-md" style={{ background: accent }} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
