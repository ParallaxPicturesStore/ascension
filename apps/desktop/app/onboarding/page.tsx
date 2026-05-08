"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Input, Button, AuthLayout } from "@/components/ui";
import { StepHeader } from "@/components/ui/StepHeader";

const GOALS = [
  "Freedom from pornography",
  "Strengthen my relationship",
  "Better mental health",
  "Build self-discipline",
  "Spiritual growth",
];

export default function OnboardingStep1() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    "Freedom from pornography",
    "Strengthen my relationship",
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleGoal(goal: string) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name."); return; }
    if (selectedGoals.length === 0) { setError("Please select at least one goal."); return; }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }

    const { error } = await supabase
      .from("users")
      .update({ name: name.trim(), goals: selectedGoals.join(", ") })
      .eq("id", session.user.id);

    if (error) {
      console.error("[Onboarding] Failed to update profile:", error);
      setLoading(false);
      return;
    }

    router.push("/onboarding/partner");
  }

  const canContinue = name.trim().length > 0 && selectedGoals.length > 0;

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <div className="flex-1 flex items-center justify-center px-lg py-2xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          <StepHeader
            step={1}
            total={3}
            title="About you"
            subtitle="Tell us your name and what you want to achieve."
          />

          <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
            <Input
              id="name"
              type="text"
              label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              required
            />

            <div>
              <p
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-heading)",
                  fontWeight: "var(--font-weight-auth-heading)",
                  color: "var(--color-foreground)",
                  marginBottom: "20px",
                }}
              >
                What are your goals?
              </p>
              <p
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-body)",
                  color: "var(--color-muted)",
                  marginBottom: "var(--spacing-md)",
                }}
              >
                Select all that apply.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                {GOALS.map((goal) => {
                  const checked = selectedGoals.includes(goal);
                  return (
                    <label
                      key={goal}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-sm)",
                        cursor: "pointer",
                        fontFamily: "var(--font-auth)",
                        fontSize: "var(--font-size-auth-label)",
                        color: "var(--color-foreground)",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGoal(goal)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        aria-hidden="true"
                        style={{
                          width: "1.125rem",
                          height: "1.125rem",
                          borderRadius: "0.25rem",
                          border: checked ? "none" : "1.5px solid var(--color-card-border)",
                          background: checked ? "var(--color-accent)" : "var(--color-card-bg)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "background 150ms ease, border 150ms ease",
                        }}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      {goal}
                    </label>
                  );
                })}
              </div>
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-caption)",
                  color: "var(--color-danger)",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant={canContinue ? "primary" : "outline"}
              fullWidth
              loading={loading}
              disabled={!canContinue}
            >
              Continue
            </Button>
          </form>

        </div>
      </div>
    </AuthLayout>
  );
}
