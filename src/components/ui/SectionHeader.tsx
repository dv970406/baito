import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SectionHeaderProps {
  title: ReactNode;
  /** 오른쪽 보조 슬롯. href 가 있으면 링크(accent 700), 없으면 caption 텍스트 */
  aside?: ReactNode;
  href?: string;
  /** 보조 링크의 aria-label (예: "단골 도감으로") */
  asideLabel?: string;
  className?: string;
}

/**
 * 섹션 머리. 왼쪽 h2(text-heading) + 오른쪽 캡션 또는 "도감" 같은 링크.
 */
export function SectionHeader({ title, aside, href, asideLabel, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="font-jp text-heading text-ink">{title}</h2>
      {aside === undefined || aside === null ? null : href ? (
        <Link
          href={href}
          aria-label={asideLabel}
          className="-my-2.5 inline-flex min-h-touch items-center text-[13px] font-bold text-accent"
        >
          {aside}
        </Link>
      ) : (
        <span className="text-caption text-ink-muted">{aside}</span>
      )}
    </div>
  );
}
