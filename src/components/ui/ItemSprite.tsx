import type { CSSProperties } from "react";
import type { ItemShape, ItemVisual } from "@/engine/types";
import { cn } from "@/lib/cn";

export type ItemSpriteSize = "sm" | "md";

export interface ItemSpriteProps {
  visual: ItemVisual;
  /** 상품 이름(일본어). 있으면 아래 알약 라벨로 보여준다 */
  name?: string;
  /** sm = 선반 38px · md = 카운터 48px */
  size?: ItemSpriteSize;
  className?: string;
}

/** 모양별 가로 비율(높이 기준) */
const WIDE: Partial<Record<ItemShape, number>> = { bento: 1.92, tray: 1.6, bar: 1.5, can: 0.7, bottle: 0.6, stick: 0.3, cup: 0.85 };

const BASE_PX: Record<ItemSpriteSize, number> = { sm: 38, md: 48 };

/**
 * 카운터/선반 위 상품. ItemVisual(모양 + 색 + 보조색)으로 그린 단순 CSS 도형과 이름 알약.
 * 상품 색은 씬 전용 hex 라 style 로 받는다. role="img" + 상품 이름.
 */
export function ItemSprite({ visual, name, size = "md", className }: ItemSpriteProps) {
  const h = BASE_PX[size];
  const w = Math.round(h * (WIDE[visual.shape] ?? 1));
  const accent = visual.accent ?? visual.color;
  return (
    <div
      role="img"
      aria-label={name ?? "상품"}
      data-shape={visual.shape}
      className={cn("inline-flex flex-col items-center gap-1.5", className)}
    >
      <div className="relative flex items-end justify-center" style={{ width: w, height: h }}>
        <Shape shape={visual.shape} color={visual.color} accent={accent} />
      </div>
      {name ? (
        <span lang="ja" className="whitespace-nowrap rounded-pill bg-surface-raised px-2 py-0.5 font-jp text-caption font-bold text-ink">
          {name}
        </span>
      ) : null}
    </div>
  );
}

function Shape({ shape, color, accent }: { shape: ItemShape; color: string; accent: string }) {
  const bg: CSSProperties = { background: color };
  const ac: CSSProperties = { background: accent };
  const border: CSSProperties = { borderColor: accent };
  switch (shape) {
    case "bento":
      // 뚜껑 열린 도시락: 흰 용기 + 보조색 테두리 + 세 칸 반찬
      return (
        <div className="flex size-full items-stretch gap-1 rounded-lg border-2 bg-surface-raised p-1.5" style={border}>
          <span className="flex-1 rounded-xs" style={bg} />
          <span className="flex-1 rounded-xs" style={ac} />
          <span className="flex-1 rounded-xs opacity-70" style={bg} />
        </div>
      );
    case "onigiri":
      return (
        <div className="relative size-full">
          <span className="absolute inset-0 rounded-md [clip-path:polygon(50%_0,100%_100%,0_100%)]" style={bg} />
          <span className="absolute inset-x-[30%] bottom-0 h-[42%] rounded-t-xs" style={ac} />
        </div>
      );
    case "can":
      return (
        <div className="relative size-full overflow-hidden rounded-md" style={bg}>
          <span className="absolute inset-x-0 top-0 h-[14%]" style={ac} />
          <span className="absolute inset-x-[15%] top-[30%] h-[36%] rounded-xs bg-surface-raised/70" />
        </div>
      );
    case "bottle":
      return (
        <div className="relative size-full">
          <span className="absolute inset-x-[30%] top-0 h-[16%] rounded-t-xs" style={ac} />
          <span className="absolute inset-x-[18%] top-[14%] h-[14%] rounded-t-md" style={bg} />
          <span className="absolute inset-x-0 top-[26%] bottom-0 rounded-lg" style={bg} />
          <span className="absolute inset-x-[12%] top-[48%] h-[26%] rounded-xs bg-surface-raised/70" />
        </div>
      );
    case "cup":
      return (
        <div className="relative size-full">
          <span className="absolute inset-x-0 top-0 h-[14%] rounded-pill" style={ac} />
          <span className="absolute inset-x-0 top-[12%] bottom-0 rounded-b-md [clip-path:polygon(0_0,100%_0,85%_100%,15%_100%)]" style={bg} />
        </div>
      );
    case "pack":
      // 아이스·과자 봉지: 네모 + 보조색 테두리 + 가운데 라벨
      return (
        <div className="flex size-full items-center justify-center rounded-[10px] border-2" style={{ ...bg, ...border }}>
          <span className="size-[42%] rounded-full" style={ac} />
        </div>
      );
    case "box":
      return (
        <div className="relative size-full overflow-hidden rounded-md" style={bg}>
          <span className="absolute inset-x-0 top-0 h-[32%]" style={ac} />
          <span className="absolute inset-x-[42%] inset-y-0 bg-surface-raised/50" />
        </div>
      );
    case "tray":
      return (
        <div className="relative size-full">
          <span className="absolute inset-x-0 top-[25%] bottom-0 rounded-md border-b-4" style={{ ...bg, ...border }} />
          <span className="absolute inset-x-[10%] top-0 h-[55%] rounded-t-lg bg-surface-raised/80" />
        </div>
      );
    case "stick":
      return (
        <div className="relative size-full">
          <span className="absolute inset-x-0 top-0 h-[60%] rounded-pill" style={bg} />
          <span className="absolute inset-x-[25%] bottom-0 h-[45%] rounded-pill" style={ac} />
        </div>
      );
    case "bar":
      return (
        <div className="relative size-full">
          <span className="absolute inset-x-0 inset-y-[22%] rounded-md" style={bg} />
          <span className="absolute inset-y-[22%] left-0 w-[14%] rounded-l-md" style={ac} />
          <span className="absolute inset-y-[22%] right-0 w-[14%] rounded-r-md" style={ac} />
        </div>
      );
    default:
      return <div className="size-full rounded-md" style={bg} />;
  }
}
