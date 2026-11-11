import type { ReactNode } from "react";
import type { WorkplaceId } from "@/engine/types";
import { cn } from "@/lib/cn";

export type ScreenTone = "surface" | "shell" | "accent";
export type ScreenTheme = "hiru" | "shinya";

export interface ScreenProps {
  /** 배경 톤. surface=직장 화면, shell=이력서/셸, accent=영수증(현재 직장 색) */
  tone?: ScreenTone;
  /** 시간대 테마 강제 (기본은 <html data-theme> 상속) */
  theme?: ScreenTheme;
  /** 직장 슬롯 강제 (accent 색이 따라온다) */
  workplace?: WorkplaceId;
  /** 하단 고정 요소 — 보통 <TabBar /> 또는 <SafeBottom /> */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

const TONE_CLASS: Record<ScreenTone, string> = {
  surface: "bg-surface text-ink",
  shell: "bg-shell text-shell-ink",
  accent: "bg-accent text-brand-ink",
};

/**
 * 앱 프레임. 폰에서는 전체 폭, 큰 화면에서는 430px 가운데 컬럼.
 * 자식은 세로 flex 로 쌓이고 `footer` 는 항상 맨 아래 붙는다. 상단은 pt-safe-top(54).
 */
export function Screen({ tone = "surface", theme, workplace, footer, className, children }: ScreenProps) {
  return (
    <main
      data-theme={theme}
      data-workplace={workplace}
      className={cn(
        "relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col pt-safe-top font-jp",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
      {footer ? <div className="mt-auto">{footer}</div> : null}
    </main>
  );
}
