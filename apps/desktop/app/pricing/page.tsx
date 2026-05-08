"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button, AuthLayout } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "£14.99",
    period: "month",
    badge: null,
    features: [
      "Real-time screen monitoring",
      "AI-powered content detection",
      "Instant partner alerts",
      "Streak tracking",
      "Multi-device support",
      "Partner dashboard",
    ],
  },
  {
    id: "annual",
    name: "Annual",
    price: "£119.88",
    period: "year",
    badge: "Save 33%",
    features: [
      "Everything in monthly",
      "Priority support",
      "Advanced analytics",
      "Custom blocklist",
      "Early access to new features",
    ],
  },
] as const;

type PlanId = (typeof PLANS)[number]["id"];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7L5.5 10.5L12 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId>("annual");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  // Start free trial — opens Stripe checkout for the selected plan
  async function handleStartTrial() {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { 
      setLoading(false);
      router.push("/login"); 
      return; 
    }

    try {
      console.log("[Pricing] Opening checkout for plan:", selected);
      
      // Try Electron IPC first
      if (typeof window !== "undefined" && window.ascension) {
        await window.ascension.notifyLoggedIn(
          session.user.id,
          session.access_token,
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const result = await window.ascension.openCheckout(
          session.user.id,
          session.user.email || "",
          selected
        );
        
        console.log("[Pricing] Checkout result:", result);
        
        if (!result?.success) {
          console.warn("[Pricing] Stripe checkout failed");
          alert("Unable to open payment page. Please try again or continue with free trial.");
          setLoading(false);
          return;
        }
        
        console.log("[Pricing] Stripe checkout opened successfully");
      } else {
        // Fallback: Call Edge Function directly (for browser testing)
        console.log("[Pricing] Using browser fallback - calling Edge Function directly");
        
        const { data, error } = await supabase.functions.invoke("ascension-api", {
          body: {
            action: "billing.createCheckout",
            payload: {
              user_id: session.user.id,
              email: session.user.email || "",
              plan: selected
            }
          }
        });

        if (error) {
          console.error("[Pricing] Edge Function error:", error);
          alert("Unable to open payment page. Please try again or continue with free trial.");
          setLoading(false);
          return;
        }

        if (data?.url) {
          console.log("[Pricing] Opening Stripe checkout URL:", data.url);
          window.open(data.url, "_blank");
        } else {
          console.error("[Pricing] No checkout URL returned");
          alert("Unable to open payment page. Please try again or continue with free trial.");
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error("[Pricing] Error opening checkout:", error);
      alert("An error occurred. Please try again or continue with free trial.");
    }
    
    setLoading(false);
  }

  // Skip — user stays on free trial, no Stripe interaction
  function handleSkip() {
    setSkipping(true);
    router.push("/onboarding/permissions");
  }

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <BackButton href="/onboarding/confirm" />

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
              Choose your plan
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
              14-day free trial on all plans. Cancel anytime.
            </p>
          </div>

          {/* Plan cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)", marginBottom: "var(--spacing-xl)" }}>
            {PLANS.map((plan) => {
              const isSelected = selected === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelected(plan.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isSelected ? "var(--color-accent-light)" : "var(--color-card-bg)",
                    border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-card-border)"}`,
                    borderRadius: "var(--radius-card)",
                    padding: "var(--spacing-base)",
                    cursor: "pointer",
                    transition: "border-color 150ms ease, background 150ms ease",
                  }}
                >
                  {/* Plan header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--spacing-xs)" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-auth)",
                        fontSize: "var(--font-size-auth-label)",
                        fontWeight: "var(--font-weight-auth-heading)",
                        color: "var(--color-foreground)",
                      }}
                    >
                      {plan.name}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
                      {plan.badge && (
                        <span
                          style={{
                            fontFamily: "var(--font-auth)",
                            fontSize: "var(--font-size-auth-caption)",
                            fontWeight: "var(--font-weight-auth-heading)",
                            color: "var(--color-accent)",
                            background: "var(--color-accent-light)",
                            border: "1px solid var(--color-accent)",
                            borderRadius: "var(--radius-pill)",
                            padding: "2px 10px",
                          }}
                        >
                          {plan.badge}
                        </span>
                      )}
                      {/* Radio indicator */}
                      <span
                        aria-hidden="true"
                        style={{
                          width: "1.125rem",
                          height: "1.125rem",
                          borderRadius: "50%",
                          border: isSelected ? "none" : "1.5px solid var(--color-card-border)",
                          background: isSelected ? "var(--color-accent)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "background 150ms ease",
                        }}
                      >
                        {isSelected && (
                          <svg width="8" height="7" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: "var(--spacing-xs)", marginBottom: "var(--spacing-sm)" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-auth)",
                        fontSize: "var(--font-size-auth-heading)",
                        fontWeight: "var(--font-weight-auth-heading)",
                        color: "var(--color-foreground)",
                      }}
                    >
                      {plan.price}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-auth)",
                        fontSize: "var(--font-size-auth-label)",
                        color: "var(--color-muted)",
                      }}
                    >
                      {plan.period}
                    </span>
                  </div>

                  {/* Features */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-xs)" }}>
                    {plan.features.map((f) => (
                      <div
                        key={f}
                        style={{ display: "flex", alignItems: "center", gap: "var(--spacing-xs)" }}
                      >
                        <span style={{ color: "var(--color-success)", flexShrink: 0 }}>
                          <CheckIcon />
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-auth)",
                            fontSize: "var(--font-size-auth-caption)",
                            color: "var(--color-foreground)",
                          }}
                        >
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* CTA buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {/* Primary — always enabled, no mandatory selection */}
            <Button
              type="button"
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleStartTrial}
            >
              Start free trial
            </Button>

            {/* Skip — stays on trial without Stripe */}
            <Button
              type="button"
              variant="outline"
              fullWidth
              loading={skipping}
              onClick={handleSkip}
            >
              Continue with free trial
            </Button>
          </div>

          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-caption)",
              color: "var(--color-muted)",
              marginTop: "var(--spacing-sm)",
            }}
          >
            Payments processed securely via Stripe. Cancel anytime from your account settings.
          </p>

        </div>
      </div>
    </AuthLayout>
  );
}
