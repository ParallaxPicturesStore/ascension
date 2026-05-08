"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/ui";

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Log the successful checkout
    console.log("[Billing] Checkout successful, session:", sessionId);

    // Redirect to the next onboarding step after a brief delay
    const timer = setTimeout(() => {
      router.push("/onboarding/permissions");
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId, router]);

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
          {/* Success icon */}
          <div
            style={{
              width: "4rem",
              height: "4rem",
              borderRadius: "50%",
              backgroundColor: "var(--color-success-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "var(--spacing-lg)",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
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
            Payment successful!
          </h1>

          <p
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-body)",
              color: "var(--color-muted)",
              marginTop: "var(--spacing-xs)",
              marginBottom: 0,
            }}
          >
            Redirecting you to complete setup...
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
