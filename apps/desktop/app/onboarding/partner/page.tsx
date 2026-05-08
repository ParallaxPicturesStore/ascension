"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkPartner, supabase } from "@/lib/supabase";
import { Input, Button, AuthLayout } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { StepHeader } from "@/components/ui/StepHeader";

const STORAGE_KEY = "step2";

// What the partner will see — uses the copied SVG icons from public/icons/
const PARTNER_VISIBILITY = [
  { icon: "/icons/chart.svg",   text: "Your current streak and progress" },
  { icon: "/icons/warning.svg", text: "Alerts when concerning content is detected" },
  { icon: "/icons/blocked.svg", text: "Blocked access attempts" },
  { icon: "/icons/shield.svg",  text: "They will NOT see screenshots or specific URLs" },
  { icon: "/icons/lock.svg",    text: "They will NOT see your browsing history" },
];

export default function OnboardingPartner() {
  const router = useRouter();
  const [partnerEmail, setPartnerEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }

    const normalised = partnerEmail.trim().toLowerCase();

    if (normalised === session.user.email?.trim().toLowerCase()) {
      setError("You can't be your own accountability partner");
      setLoading(false);
      return;
    }

    try {
      await linkPartner(session.user.id, normalised);
    } catch (err) {
      console.error("[Onboarding] Failed to link partner:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Send invite email (non-blocking)
    try {
      if (normalised && typeof window !== "undefined" && window.ascension?.invitePartner) {
        const { data: profile } = await supabase
          .from("users")
          .select("name")
          .eq("id", session.user.id)
          .single();

        await window.ascension.invitePartner(
          normalised,
          profile?.name || "Your partner",
          {
            inviterUserId: session.user.id,
            accessToken: session.access_token,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          }
        );
      }
    } catch (err) {
      console.error("[Onboarding] Failed to send partner invite:", err);
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <AuthLayout imageSrc="/login-bg.png">
      {/* Back button — step 2 can go back to step 1 */}
      <BackButton href="/onboarding" />

      <div className="flex-1 flex items-center justify-center px-lg py-xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          <StepHeader
            step={2}
            total={3}
            title="Choose your partner"
            subtitle="Pick someone you trust. A friend, partner or mentor who will hold you accountable. Your partner will receive an email invitation to create their account."
          />

          <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-lg)" }}>
            {sent ? (
              /* Success state — mirrors mobile */
              <div
                style={{
                  background: "var(--color-success-light)",
                  border: "1px solid var(--color-success)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--spacing-base)",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    fontWeight: "var(--font-weight-auth-heading)",
                    color: "var(--color-success)",
                    margin: "0 0 var(--spacing-xs) 0",
                  }}
                >
                  Invitation sent
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    color: "var(--color-success)",
                    margin: 0,
                  }}
                >
                  We sent an invite to <strong>{partnerEmail}</strong>. They will receive instructions to create their account.
                </p>
              </div>
            ) : (
              <>
                <Input
                  id="partner-email"
                  type="email"
                  label="Partner's email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="Enter partner's email"
                  required={!sent}
                />

                {/* What will your partner see */}
                <div
                  style={{
                    borderRadius: "var(--radius-card)",
                    border: "1px solid var(--color-card-border)",
                    padding: "var(--spacing-base)",
                    background: "#F8FAFF"
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
                    What will your partner see?
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
                    {PARTNER_VISIBILITY.map(({ icon, text }) => (
                      <div key={text} style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)" }}>
                        <img src={icon} alt="" aria-hidden="true" style={{ width: "1.25rem", height: "1.25rem", flexShrink: 0 }} />
                        <span style={{ fontFamily: "var(--font-auth)", fontSize: "var(--font-size-auth-label)", color: "var(--color-foreground)" }}>
                          {text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {error && (
              <p role="alert" style={{ fontFamily: "var(--font-auth)", fontSize: "var(--font-size-auth-caption)", color: "var(--color-danger)", margin: 0 }}>
                {error}
              </p>
            )}

            {/* Primary button — changes label after sent */}
            <Button
              type={sent ? "button" : "submit"}
              variant="primary"
              fullWidth
              loading={loading}
              disabled={!sent && !partnerEmail.trim()}
              onClick={sent ? () => router.push("/onboarding/confirm") : undefined}
            >
              {sent ? "Continue" : "Send Invite & Continue"}
            </Button>

            {/* Skip — only shown before invite is sent */}
            {!sent && (
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => {
                  router.push("/onboarding/confirm");
                }}
              >
                Skip for now - I&apos;ll add a partner later
              </Button>
            )}
          </form>

        </div>
      </div>
    </AuthLayout>
  );
}
