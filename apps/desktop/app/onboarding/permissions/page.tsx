"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearAllOnboardingData } from "@/lib/onboarding";
import { Button, AuthLayout } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";

const STEPS = [
  "Enable screen recording.",
  "Allow accessibility access.",
  "Allow notifications.",
];

export default function PermissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnable() {
    setLoading(true);
    try {
      if (typeof window !== "undefined" && window.ascension?.requestPermissions) {
        await window.ascension.requestPermissions();
      }
    } catch (err) {
      console.error("[Permissions] Failed to request permissions:", err);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Mark complete in DB by ensuring name+goals are set (already done in step1)
      // Just clear localStorage — DB inference will show complete
    }
    clearAllOnboardingData();
    router.push("/onboarding/protected");
  }

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <BackButton href="/pricing" />

      <div className="flex-1 flex items-center justify-center px-lg py-xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          {/* Heading */}
          <div style={{ marginBottom: "var(--spacing-xl)" }}>
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
              Turn on monitoring
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
              To protect you, Ascension needs access to your device activity.
            </p>
          </div>

          {/* Steps list card */}
          <div
            style={{
              background: "var(--color-accent-light)",
              borderRadius: "var(--radius-card)",
              padding: "var(--spacing-base)",
              marginBottom: "var(--spacing-xl)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-auth)",
                fontSize: "var(--font-size-auth-label)",
                fontWeight: "var(--font-weight-auth-heading)",
                color: "var(--color-foreground)",
                marginBottom: "var(--spacing-sm)",
              }}
            >
              Steps list
            </p>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--spacing-xs)" }}>
              {STEPS.map((step, i) => (
                <li
                  key={step}
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {i + 1}. {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleEnable}
              leftIcon={
                <img src="/icons/lock.svg" alt="" aria-hidden="true" style={{ width: "1rem", height: "1rem", filter: "brightness(0) invert(1)" }} />
              }
            >
              Enable monitoring
            </Button>

            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={async () => {
                clearAllOnboardingData();
                router.push("/onboarding/protected");
              }}
            >
              I&apos;ll do this later
            </Button>
          </div>

        </div>
      </div>
    </AuthLayout>
  );
}
