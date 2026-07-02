import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-court-700 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-court-700 text-white hover:bg-court-800 border border-court-700 hover:border-court-800",
  secondary:
    "bg-transparent text-court-800 border border-court-700/40 hover:border-court-700 hover:bg-court-50",
  ghost: "bg-transparent text-court-800 border border-transparent hover:bg-court-50",
  danger: "bg-transparent text-danger-fg border border-danger-fg/40 hover:bg-danger-bg",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-12 px-5 text-[0.94rem]",
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonAsLink = CommonProps & { href: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "href"
  >;

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    className = "",
    children,
    ...rest
  } = props;
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();

  if (rest.href !== undefined) {
    const { href, ...anchorProps } = rest as Omit<ButtonAsLink, keyof CommonProps>;
    // Drop explicitly-undefined entries: LinkProps rejects them under exactOptionalPropertyTypes.
    const defined = Object.fromEntries(
      Object.entries(anchorProps).filter(([, value]) => value !== undefined),
    ) as Omit<ComponentProps<typeof Link>, "href" | "className" | "children">;
    return (
      <Link className={classes} data-variant={variant} href={href} {...defined}>
        {children}
      </Link>
    );
  }

  const buttonProps = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button
      className={classes}
      data-variant={variant}
      type={buttonProps.type ?? "button"}
      {...buttonProps}
      disabled={loading || buttonProps.disabled}
      aria-busy={loading || undefined}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
