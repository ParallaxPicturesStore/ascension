"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthGate } from "@/components/AuthProvider";
import { Button, AuthLayout } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { StepHeader } from "@/components/ui/StepHeader";

interface Summary {
  name: string;
  goals: string;
  partnerEmail: string;
}

export default function OnboardingConfirm() {
  const router = useRouter();
  const { completeOnboarding } = useAuthGate();
  const [summary, setSummary] = useState<Summary>({ name: "", goals: "", partnerEmail: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadSummary() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data } = await supabase
        .from("users")
        .select("name, goals, partner_email")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setSummary({
          name: data.name || "",
          goals: data.goals || "",
          partnerEmail: data.partner_email || "",
        });
      }
    }
    loadSummary();
  }, [router]);

  async function handleConfirm() {
    setLoading(true);
    completeOnboarding(); // Tell auth gate onboarding is done
    router.push("/pricing");
  }

  const rows: { label: string; value: string; empty: string }[] = [
    { label: "Your name",      value: summary.name,        empty: "Not set" },
    { label: "Your goals",     value: summary.goals,       empty: "None selected" },
    { label: "Partner's email",value: summary.partnerEmail, empty: "Not invited yet" },
  ];

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <BackButton href="/onboarding/partner" />

      <div className="flex-1 flex items-center justify-center px-lg py-xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          <StepHeader
            step={3}
            total={3}
            title="You're all set"
            subtitle="Here's a summary of your setup. You can change any of these in Settings later:"
          />

          {/* Summary card */}
          <div
            style={{
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-card)",
              overflow: "hidden",
              marginBottom: "var(--spacing-xl)",
            }}
          >
            {rows.map(({ label, value, empty }, i) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--spacing-md) var(--spacing-base)",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--color-card-border)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    color: "var(--color-foreground)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    color: value ? "var(--color-foreground)" : "var(--color-muted)",
                    fontWeight: value ? "var(--font-weight-auth-heading)" : "var(--font-weight-auth-body)",
                    textAlign: "right",
                    maxWidth: "55%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {value || empty}
                </span>
              </div>
            ))}
          </div>

          <Button type="button" variant="primary" fullWidth loading={loading} onClick={handleConfirm}>
            Confirm
          </Button>

        </div>
      </div>
    </AuthLayout>
  );
}
