import Link from "next/link";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

export type TabKey = "shift" | "regulars" | "receipt" | "league";

export interface TabBarProps {
  /** 현재 화면의 탭 */
  active: TabKey;
  /** 탭별 링크 덮어쓰기 */
  hrefs?: Partial<Record<TabKey, string>>;
  className?: string;
}

interface TabDef {
  key: TabKey;
  label: string;
  icon: IconName;
  href: string;
}

const TABS: readonly TabDef[] = [
  { key: "shift", label: "시프트", icon: "calendar", href: "/konbini" },
  { key: "regulars", label: "도감", icon: "book", href: "/konbini/regulars" },
  { key: "receipt", label: "영수증", icon: "receipt", href: "/konbini/receipt" },
  { key: "league", label: "리그", icon: "trophy", href: "/konbini/league" },
];

/**
 * 하단 탭바 4개 (시프트 · 도감 · 영수증 · 리그).
 * 활성 탭은 accent 800, 비활성은 ink-muted(디자인 시스템의 대비 수정 — ink-faint 금지).
 * 패딩 10/12/28, 위쪽 1px 선(shadow-hairline-up).
 */
export function TabBar({ active, hrefs, className }: TabBarProps) {
  return (
    <nav
      aria-label="주 메뉴"
      className={cn(
        "flex items-center justify-around bg-surface-raised px-3 pb-safe-tab pt-2.5 shadow-hairline-up",
        className,
      )}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={hrefs?.[tab.key] ?? tab.href}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-touch min-w-16 flex-col items-center justify-center gap-1 rounded-lg text-label",
              isActive ? "font-extrabold text-accent" : "text-ink-muted",
            )}
          >
            <Icon name={tab.icon} size={22} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
