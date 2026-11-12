"use client";

import { useT } from "@/i18n/useT";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

export interface LockedCardProps {
  /** 제목 ("저녁 손님", "HOTERU · 호텔 프론트") */
  title: ReactNode;
  /** 한 줄 설명 */
  caption?: ReactNode;
  /** 해금 조건 ("저녁 시프트", "KONBINI 점장 달성 시 지원 가능") */
  hint?: ReactNode;
  /** grid = 도감 3열 카드("?" 아바타) · shell = 이력서 직장 카드(아이콘 타일 + 잠금) */
  variant?: "grid" | "shell";
  /** shell 변형의 타일 아이콘 */
  icon?: IconName;
  /** shell 변형에서 잠금 아이콘 대신 보여줄 배지 등 */
  trailing?: ReactNode;
  className?: string;
}

/**
 * 잠긴 카드(점선 테두리). 도감 그리드에서는 "?" 아바타 세로형, 이력서에서는 아이콘 타일 가로형.
 */
export function LockedCard({ title, caption, hint, variant = "grid", icon, trailing, className }: LockedCardProps) {
  const { t } = useT();
  if (variant === "shell") {
    return (
      <div
        className={cn(
          "flex gap-3.5 rounded-4xl border-[1.5px] border-dashed border-shell-border bg-shell-raised p-4 text-shell-ink",
          className,
        )}
      >
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-shell-border text-ink-faint">
          {icon ? <Icon name={icon} size={30} /> : <span className="text-[18px] font-extrabold text-ink-muted">?</span>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-jp text-heading text-border-strong">{title}</span>
            {trailing ?? <Icon name="lock" size={18} label={t("common.locked")} className="text-ink-faint" />}
          </div>
          {caption ? <span className="text-caption text-ink-muted">{caption}</span> : null}
          {hint ? <span className="mt-1 text-label text-shell-muted">{hint}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-border-strong bg-surface-sunken px-1.5 py-3 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-avatar items-center justify-center rounded-full bg-border text-[18px] font-extrabold text-ink-muted"
      >
        ?
      </span>
      <span className="font-jp text-[13px] font-extrabold text-ink-muted">{title}</span>
      {caption ? <span className="text-micro font-bold text-ink-muted">{caption}</span> : null}
      {hint ? (
        <span className="inline-flex items-center gap-1 text-micro font-bold text-ink-muted">
          <Icon name="lock" size={14} />
          {hint}
        </span>
      ) : null}
    </div>
  );
}
