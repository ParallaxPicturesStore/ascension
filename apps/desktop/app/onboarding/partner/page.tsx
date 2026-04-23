"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingPartner() {
  const router = useRouter();
  const [partnerEmail, setPartnerEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    // Can't be your own partner
    if (partnerEmail === session.user.email) {
      setError("You can't be your own accountability partner");
      setLoading(false);
      return;
    }

    // Save partner email
    const { error: updateError } = await supabase
      .from("users")
      .update({ partner_email: partnerEmail })
      .eq("id", session.user.id);

    if (updateError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Send invitation email to partner via Electron IPC -> Resend
    if (typeof window !== "undefined" && window.ascension?.invitePartner) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("name")
        .eq("id", session.user.id)
        .single();

      await window.ascension.invitePartner(
        partnerEmail,
        userProfile?.name || "Your partner",
        session.user.id,
      );
    }

    router.push("/onboarding/confirm");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs text-accent font-medium uppercase tracking-wider mb-2">
            Step 2 of 3
          </div>
          <h1 className="text-2xl font-bold">Choose Your Partner</h1>
          <p className="text-sm text-muted mt-2">
            Pick someone you trust. A friend, partner, or mentor who will hold
            you accountable.
          </p>
        </div>

        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">
              Partner&apos;s Email
            </label>
            <input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent text-sm"
              placeholder="partner@email.com"
              required
            />
          </div>

          <div className="bg-card-bg border border-card-border rounded-lg p-4">
            <p className="text-xs text-muted leading-relaxed">
              Your partner will receive an email invitation to create their
              account. They&apos;ll be able to see your streak, flagged alerts,
              and blocked access attempts. They won&apos;t see your browsing
              history.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading || !partnerEmail.trim()}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "Sending invite..." : "Send Invite & Continue"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/onboarding/confirm")}
            className="w-full text-muted hover:text-foreground text-sm transition-colors py-2"
          >
            Skip for now - I&apos;ll add a partner later
          </button>
        </form>
      </div>
    </div>
  );
}
