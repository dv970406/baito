import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardVariant = "raised" | "sunken" | "shell" | "accent";
export type CardPadding = "none" | "sm" | "md" | "lg";
export type CardRadius = "2xl" | "3xl" | "4xl";
export type CardElevation = "auto" | "none" | "hairline" | "press" | "press-lg";

interface CardOwnProps {
  /** raised=흰 카드(1px 선) · sunken=선반/잠김 · shell=이력서 카드 · accent=출근 카드 */
  variant?: CardVariant;
  /** 점선 테두리(잠김 상태). shell 이면 shell-border 색 */
  dashed?: boolean;
  /** none 0 · sm 12 · md 14 · lg 16 */
  padding?: CardPadding;
  /** 2xl 16 · 3xl 18(기본) · 4xl 20 */
  radius?: CardRadius;
  /** 그림자(선). auto 는 variant 기본값을 따른다 */
  elevation?: CardElevation;
  className?: string;
  children?: ReactNode;
}

type CardDivProps = CardOwnProps & { as?: "div" } & Omit<ComponentPropsWithoutRef<"div">, keyof CardOwnProps>;
type CardLinkProps = CardOwnProps & { as: "link"; href: string } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    keyof CardOwnProps | "href"
  >;
type CardButtonProps = CardOwnProps & { as: "button" } & Omit<
    ComponentPropsWithoutRef<"button">,
    keyof CardOwnProps
  >;

export type CardProps = CardDivProps | CardLinkProps | CardButtonProps;

const VARIANT_CLASS: Record<CardVariant, string> = {
  raised: "bg-surface-raised text-ink",
  sunken: "bg-surface-sunken text-ink",
  shell: "bg-shell-raised text-shell-ink",
  accent: "bg-accent text-brand-ink",
};

const DEFAULT_ELEVATION: Record<CardVariant, Exclude<CardElevation, "auto">> = {
  raised: "hairline",
  sunken: "none",
  shell: "none",
  accent: "press",
};

const ELEVATION_CLASS: Record<Exclude<CardElevation, "auto">, string> = {
  none: "",
  hairline: "shadow-hairline",
  press: "shadow-press",
  "press-lg": "shadow-press-lg",
};

const PADDING_CLASS: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-3.5",
  lg: "p-4",
};

const RADIUS_CLASS: Record<CardRadius, string> = {
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  "4xl": "rounded-4xl",
};

function cardClass({
  variant = "raised",
  dashed = false,
  padding = "md",
  radius = "3xl",
  elevation = "auto",
  className,
}: CardOwnProps): string {
  const resolvedElevation = elevation === "auto" ? (dashed ? "none" : DEFAULT_ELEVATION[variant]) : elevation;
  return cn(
    "block",
    RADIUS_CLASS[radius],
    VARIANT_CLASS[variant],
    PADDING_CLASS[padding],
    ELEVATION_CLASS[resolvedElevation],
    dashed && "border-[1.5px] border-dashed",
    dashed && (variant === "shell" ? "border-shell-border" : "border-border-strong"),
    className,
  );
}

/**
 * 카드 컨테이너. 기본은 `rounded-3xl bg-surface-raised shadow-hairline` (그림자 대신 1px 선).
 * `as` 로 div · link(next/link) · button 중 하나로 렌더링한다.
 */
export function Card(props: CardProps) {
  if (props.as === "link") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` 는 DOM 으로 흘러가면 안 되므로 떼어낸다
    const { as: _as, variant, dashed, padding, radius, elevation, className, children, ...rest } = props;
    return (
      <Link {...rest} className={cardClass({ variant, dashed, padding, radius, elevation, className })}>
        {children}
      </Link>
    );
  }
  if (props.as === "button") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` 는 DOM 으로 흘러가면 안 되므로 떼어낸다
    const { as: _as, variant, dashed, padding, radius, elevation, className, children, type, ...rest } = props;
    return (
      <button
        type={type ?? "button"}
        {...rest}
        className={cn("text-left", cardClass({ variant, dashed, padding, radius, elevation, className }))}
      >
        {children}
      </button>
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- `as` 는 DOM 으로 흘러가면 안 되므로 떼어낸다
  const { as: _as, variant, dashed, padding, radius, elevation, className, children, ...rest } = props;
  return (
    <div {...rest} className={cardClass({ variant, dashed, padding, radius, elevation, className })}>
      {children}
    </div>
  );
}
