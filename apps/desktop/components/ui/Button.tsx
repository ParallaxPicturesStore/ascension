import { type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "outline" | "dark" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * All colours reference CSS variables from globals.css which mirror theme.ts.
 * primary  = theme.colors.primary  (#223D8C)
 * outline  = white bg, theme.colors.border border
 * dark     = theme.colors.secondary (#111111)
 * ghost    = transparent bg, primary text
 */
const variantStyles: Record<
  ButtonVariant,
  { bg: string; bgHover: string; color: string; border?: string }
> = {
  primary: {
    bg:      "var(--color-primary)",
    bgHover: "var(--color-primary-hover)",
    color:   "var(--color-on-primary)",
  },
  dark: {
    bg:      "var(--color-secondary)",
    bgHover: "#333333",
    color:   "var(--color-on-accent)",
  },
  outline: {
    bg:      "var(--color-surface)",
    bgHover: "var(--color-accent-light)",
    color:   "var(--color-foreground)",
    border:  "1.5px solid var(--color-border)",
  },
  ghost: {
    bg:      "transparent",
    bgHover: "var(--color-accent-light)",
    color:   "var(--color-primary)",
  },
};

/**
 * Heights match theme.components:
 *   md = 58px (theme.components.button.height)
 *   sm = 44px
 *   lg = 64px
 */
const sizeStyles: Record<ButtonSize, { height: string; fontSize: string; padding: string }> = {
  sm: {
    height:   "2.75rem",                          /* 44px */
    fontSize: "var(--font-size-auth-label)",      /* 16px */
    padding:  "0 var(--spacing-md)",
  },
  md: {
    height:   "var(--button-height)",             /* 58px — theme.components.button.height */
    fontSize: "var(--font-size-button)",          /* 18px — theme.fontSize.button */
    padding:  "0 var(--spacing-lg)",
  },
  lg: {
    height:   "4rem",                             /* 64px */
    fontSize: "var(--font-size-body-lg)",         /* 18px */
    padding:  "0 var(--spacing-xl)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      aria-busy={loading}
      style={{
        display:         "inline-flex",
        alignItems:      "center",
        justifyContent:  "center",
        gap:             "var(--spacing-sm)",
        width:           fullWidth ? "100%" : undefined,
        height:          s.height,
        padding:         s.padding,
        borderRadius:    "var(--radius-button)",  /* 999px pill — theme.borderRadius.button */
        border:          isDisabled ? "none" : (v.border ?? "none"),
        background:      isDisabled ? "#D1D5DB" : v.bg,
        color:           isDisabled ? "#9CA3AF" : v.color,
        fontFamily:      "var(--font-auth)",
        fontSize:        s.fontSize,
        fontWeight:      "var(--font-weight-semibold)", /* 600 — theme.fontWeight.semiBold */
        cursor:          isDisabled ? "not-allowed" : "pointer",
        opacity:         1,
        transition:      "background 150ms ease, opacity 150ms ease",
        userSelect:      "none",
        boxSizing:       "border-box",
        letterSpacing:   "0.01em",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled)
          (e.currentTarget as HTMLButtonElement).style.background = v.bgHover;
      }}
      onMouseLeave={(e) => {
        if (!isDisabled)
          (e.currentTarget as HTMLButtonElement).style.background = v.bg;
      }}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner />
          {children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <svg
      style={{ width: "1.125rem", height: "1.125rem", animation: "spin 1s linear infinite" }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
