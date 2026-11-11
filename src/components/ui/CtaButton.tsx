"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cn } from "@/lib/cn";

export type CtaVariant = "primary" | "onSurface" | "ghost";

interface CtaOwnProps {
  /** primary = 브랜드 블루(shell 화면) · onSurface = 흰 배경 + accent 글자(accent 화면) · ghost = 반투명 흰색 */
  variant?: CtaVariant;
  /** 앞에 붙는 아이콘 */
  icon?: IconName;
  /** 로딩 중 — 비활성 + 회전 아이콘 + aria-busy */
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

type CtaButtonElProps = CtaOwnProps & { as?: "button" } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    keyof CtaOwnProps
  >;
type CtaLinkElProps = CtaOwnProps & { as: "link"; href: string } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    keyof CtaOwnProps | "href"
  >;

export type CtaButtonProps = CtaButtonElProps | CtaLinkElProps;

const VARIANT_CLASS: Record<CtaVariant, string> = {
  primary: "min-h-cta bg-brand text-brand-ink shadow-press text-base font-extrabold",
  onSurface: "min-h-cta bg-surface-raised text-accent text-base font-extrabold",
  ghost: "min-h-12 bg-white/14 text-brand-ink text-[15px] font-bold",
};

function ctaClass(variant: CtaVariant, disabled: boolean, className?: string): string {
  return cn(
    "inline-flex w-full items-center justify-center gap-2 rounded-pill px-5 font-jp leading-none",
    "transition-transform duration-[80ms] ease-out active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
    "focus-visible:shadow-focus",
    VARIANT_CLASS[variant],
    disabled && "pointer-events-none opacity-50",
    className,
  );
}

/**
 * 알약 CTA. 52px(primary/onSurface) 또는 48px(ghost). 눌리는 느낌은 shadow-press(아래 2px 단색).
 * `as="link"` 면 next/link 로 렌더링한다.
 */
export function CtaButton(props: CtaButtonProps) {
  if (props.as === "link") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` 는 DOM 으로 흘러가면 안 되므로 떼어낸다
    const { as: _as, variant = "primary", icon, loading = false, className, children, ...rest } = props;
    const disabled = loading;
    return (
      <Link
        {...rest}
        aria-disabled={disabled || undefined}
        aria-busy={loading || undefined}
        tabIndex={disabled ? -1 : rest.tabIndex}
        className={ctaClass(variant, disabled, className)}
      >
        <CtaInner icon={icon} loading={loading}>
          {children}
        </CtaInner>
      </Link>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` 는 DOM 으로 흘러가면 안 되므로 떼어낸다
  const { as: _as, variant = "primary", icon, loading = false, className, children, type, disabled, ...rest } = props;
  const isDisabled = Boolean(disabled) || loading;
  return (
    <button
      type={type ?? "button"}
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={ctaClass(variant, isDisabled, className)}
    >
      <CtaInner icon={icon} loading={loading}>
        {children}
      </CtaInner>
    </button>
  );
}

function CtaInner({ icon, loading, children }: { icon?: IconName; loading: boolean; children: ReactNode }) {
  return (
    <>
      {loading ? (
        <Icon name="refresh" size={18} strokeWidth={2.5} className="animate-spin motion-reduce:animate-none" />
      ) : icon ? (
        <Icon name={icon} size={18} strokeWidth={2.5} />
      ) : null}
      <span>{children}</span>
    </>
  );
}
