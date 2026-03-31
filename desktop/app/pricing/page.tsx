"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Check, ArrowLeft } from "lucide-react";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    price: "14.99",
    period: "/month",
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
    price: "119.88",
    period: "/year",
    badge: "Save 33%",
    features: [
      "Everything in Monthly",
      "Priority support",
      "Advanced analytics",
      "Custom blocklist",
      "Early access to new features",
    ],
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(plan: string) {
    setLoading(plan);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    if (typeof window !== "undefined" && window.ascension) {
      // Running inside Electron - use IPC
      const result = await window.ascension.openCheckout(
        session.user.id,
        session.user.email || "",
        plan
      );
      if (!result.success) {
        // Stripe not configured yet - show message
        alert(
          "Billing is not configured yet. You're on a free trial. Enjoy!"
        );
      }
    } else {
      // Running in browser - would redirect to Stripe
      alert("Please use the desktop app to subscribe.");
    }

    setLoading(null);
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Choose Your Plan</h1>
        <p className="text-sm text-muted mt-2">
          7-day free trial on all plans. Cancel anytime.
        </p>
      </div>

      <div className="space-y-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`bg-card-bg border rounded-xl p-5 ${
              plan.id === "annual"
                ? "border-accent"
                : "border-card-border"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold">
                    £{plan.price}
                  </span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>
              </div>
              {plan.badge && (
                <span className="bg-accent/10 text-accent text-xs font-semibold px-2.5 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}
            </div>

            <ul className="space-y-2 mb-4">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-foreground/80"
                >
                  <Check className="w-4 h-4 text-success shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading !== null}
              className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
                plan.id === "annual"
                  ? "bg-accent hover:bg-accent-hover text-white"
                  : "bg-card-border/50 hover:bg-card-border text-foreground"
              } disabled:opacity-50`}
            >
              {loading === plan.id
                ? "Opening checkout..."
                : "Start Free Trial"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted text-center mt-6">
        Payments processed securely via Stripe. Cancel anytime from your
        account settings.
      </p>
    </div>
  );
}
