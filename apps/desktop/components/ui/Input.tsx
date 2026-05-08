"use client";

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label?: string;
  error?: string;
  helperText?: string;
  rightIcon?: ReactNode;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, rightIcon, leftIcon, type = "text", ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? "var(--color-danger)"
      : focused
      ? "var(--color-primary)"       /* #223D8C — theme.colors.primary */
      : "var(--color-border)";       /* #D9DDE5 — theme.colors.border */

    return (
      <div style={{ width: "100%" }}>
        {/* Label — 16px Regular, theme.colors.textPrimary */}
        {label && (
          <label
            htmlFor={props.id}
            style={{
              display:      "block",
              fontFamily:   "var(--font-auth)",
              fontSize:     "var(--font-size-auth-label)",   /* 16px */
              fontWeight:   "var(--font-weight-regular)",    /* 400 */
              lineHeight:   "var(--line-height-auth-label)",
              color:        "var(--color-text-primary)",
              marginBottom: "var(--spacing-xs)",
            }}
          >
            {label}
          </label>
        )}

        {/* Input wrapper — 58px height, pill radius, 1px border */}
        <div style={{ position: "relative" }}>
          {leftIcon && (
            <div style={{
              position:  "absolute",
              left:      "var(--input-px)",
              top:       "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              lineHeight: 0,
            }}>
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            type={type}
            style={{
              width:        "100%",
              height:       "var(--input-height)",    /* 58px — theme.components.input.height */
              borderRadius: "var(--input-radius)",    /* pill */
              border:       `var(--input-border) solid ${borderColor}`,
              paddingLeft:  leftIcon ? "2.75rem" : "var(--input-px)",
              paddingRight: rightIcon ? "2.75rem" : "var(--input-px)",
              fontFamily:   "var(--font-auth)",
              fontSize:     "var(--font-size-auth-label)",  /* 16px */
              fontWeight:   "var(--font-weight-regular)",
              color:        "var(--color-text-primary)",
              background:   "var(--color-surface)",
              outline:      "none",
              transition:   "border-color 150ms ease",
              boxSizing:    "border-box",
            }}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            aria-invalid={!!error}
            aria-describedby={
              error       ? `${props.id}-error`
              : helperText ? `${props.id}-helper`
              : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div style={{
              position:  "absolute",
              right:     "var(--input-px)",
              top:       "50%",
              transform: "translateY(-50%)",
              lineHeight: 0,
            }}>
              {rightIcon}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p
            id={`${props.id}-error`}
            role="alert"
            style={{
              fontFamily:  "var(--font-auth)",
              fontSize:    "var(--font-size-auth-caption)",
              color:       "var(--color-danger)",
              marginTop:   "var(--spacing-xs)",
              marginBottom: 0,
            }}
          >
            {error}
          </p>
        )}

        {/* Helper */}
        {helperText && !error && (
          <p
            id={`${props.id}-helper`}
            style={{
              fontFamily:  "var(--font-auth)",
              fontSize:    "var(--font-size-auth-caption)",
              color:       "var(--color-muted)",
              marginTop:   "var(--spacing-xs)",
              marginBottom: 0,
            }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
