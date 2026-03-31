"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

interface Props {
  subscriptionStatus: string;
  children: React.ReactNode;
}

const LOCKED_STATUSES = ["expired", "cancelled", "past_due"];

export default function SubscriptionGate({ subscriptionStatus, children }: Props) {
  const router = useRouter();

  if (LOCKED_STATUSES.includes(subscriptionStatus)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-card-bg border border-card-border flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6 text-muted" />
          </div>

          <h1 className="text-xl font-bold mb-2">Subscription Paused</h1>
          <p className="text-sm text-muted mb-6 leading-relaxed">
            Your Ascension subscription is{" "}
            {subscriptionStatus === "past_due" ? "past due" : "no longer active"}.
            Monitoring has been paused. Renew to keep your partner informed and
            your streak protected.
          </p>

          <button
            onClick={() => router.push("/pricing")}
            className="w-full bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-lg transition-colors text-sm mb-3"
          >
            Renew Subscription
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
