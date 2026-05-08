interface StepHeaderProps {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}

export function StepHeader({ step, total, title, subtitle }: StepHeaderProps) {
  return (
    <div style={{ marginBottom: "var(--spacing-xl)" }}>
      {/* Step indicator */}
      <p
        style={{
          fontFamily: "var(--font-auth)",
          fontSize: "var(--font-size-auth-caption)",
          fontWeight: "var(--font-weight-auth-heading)",
          color: "var(--color-muted)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "var(--spacing-xs)",
        }}
      >
        Step {step} of {total}
      </p>

      {/* Title */}
      <h1
        style={{
          fontFamily: "var(--font-auth)",
          fontSize: "var(--font-size-auth-heading)",
          fontWeight: "var(--font-weight-auth-heading)",
          lineHeight: "var(--line-height-auth-heading)",
          color: "var(--color-foreground)",
          margin: 0,
        }}
      >
        {title}
      </h1>

      {/* Subtitle */}
      {subtitle && (
        <p
          style={{
            fontFamily: "var(--font-auth)",
            fontSize: "var(--font-size-auth-body)",
            fontWeight: "var(--font-weight-auth-body)",
            lineHeight: "var(--line-height-auth-body)",
            color: "var(--color-muted)",
            marginTop: "var(--spacing-xs)",
            marginBottom: 0,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
