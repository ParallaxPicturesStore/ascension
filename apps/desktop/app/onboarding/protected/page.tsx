"use client";

import { useRouter } from "next/navigation";
import { Button, AuthLayout } from "@/components/ui";

export default function ProtectedPage() {
  const router = useRouter();

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <div className="flex-1 flex items-center justify-center px-lg py-2xl">
        <div
          style={{
            width: "100%",
            maxWidth: "var(--form-width)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* Brand label */}
          <p
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-caption)",
              fontWeight: "var(--font-weight-auth-heading)",
              color: "var(--color-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "var(--spacing-lg)",
            }}
          >
            ASCENSION
          </p>

          {/* Shield icon with soft blue circle */}
          <div
            style={{
              width: "4rem",
              height: "4rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--spacing-lg)",
            }}
          >
            <img
              src="/icons/correct.png"
              alt=""
              aria-hidden="true"
              style={{ width: "4rem", height: "4rem" }}
            />
          </div>

          {/* Heading */}
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
            You&apos;re protected
          </h1>

          <p
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-body)",
              color: "var(--color-muted)",
              marginTop: "var(--spacing-xs)",
              marginBottom: "var(--spacing-xl)",
            }}
          >
            Monitoring is now active.
          </p>

          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() => router.push("/")}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
