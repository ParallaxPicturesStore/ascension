interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (!label) {
    return (
      <hr
        style={{
          width: "100%",
          border: "none",
          borderTop: "1px solid var(--color-card-border)",
          margin: 0,
        }}
      />
    );
  }

  return (
    <div
      role="separator"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-md)",
      }}
    >
      <div style={{ flex: 1, height: "1px", background: "var(--color-card-border)" }} />
      <span
        style={{
          fontFamily: "var(--font-auth)",
          fontSize: "var(--font-size-auth-caption)",
          color: "var(--color-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: "1px", background: "var(--color-card-border)" }} />
    </div>
  );
}
