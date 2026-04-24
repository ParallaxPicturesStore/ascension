"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getEffectiveSubscriptionStatus } from "@/lib/subscription";

interface Props {
  subscriptionStatus: string;
  userId: string | null;
  stripeCustomerId: string | null;
  subscriptionLapseDate: string | null;
  children: React.ReactNode;
}

const LOCKED_STATUSES = ["expired", "past_due"];

export default function SubscriptionGate({
  subscriptionStatus,
  userId,
  stripeCustomerId,
  subscriptionLapseDate,
  children,
}: Props) {
  const router = useRouter();
  const effectiveSubscriptionStatus = getEffectiveSubscriptionStatus(
    subscriptionStatus,
    subscriptionLapseDate,
  );

  async function handleSubscriptionAction() {
    if (effectiveSubscriptionStatus === "trial") {
      router.push("/pricing");
      return;
    }

    try {
      let customerId = stripeCustomerId;

      if (!customerId && userId) {
        const { data, error } = await supabase
          .from("users")
          .select("stripe_customer_id")
          .eq("id", userId)
          .single();

        if (error) throw error;
        customerId = data?.stripe_customer_id ?? null;
      }

      if (!customerId) {
        window.alert("No active subscription found to manage.");
        return;
      }

      if (!window.ascension) {
        window.alert("Please use the desktop app to manage your subscription.");
        return;
      }

      const result = await window.ascension.openBillingPortal(customerId);
      if (!result?.success) {
        window.alert("Could not open subscription portal. Please try again.");
      }
    } catch {
      window.alert("Failed to open subscription portal.");
    }
  }

  if (LOCKED_STATUSES.includes(effectiveSubscriptionStatus)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-card-bg border border-card-border flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-muted" />
          </div>

          <h1 className="text-xl font-bold mb-2">Subscription Paused</h1>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Your Ascension subscription is{" "}
            {effectiveSubscriptionStatus === "past_due" ? "past due" : "expired"}.
            Monitoring has been paused. Renew to keep your partner informed and
            your streak protected.
          </p>

          <button
            onClick={handleSubscriptionAction}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition-colors text-sm mb-3"
          >
            {effectiveSubscriptionStatus === "trial" ? "Subscribe" : "Renew Subscription"}
          </button>

          <p className="text-xs text-muted">
            Your streak and data are still saved.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
