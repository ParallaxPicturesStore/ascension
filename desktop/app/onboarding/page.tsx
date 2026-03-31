"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function OnboardingStep1() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goals, setGoals] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleNext(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ name, goals })
      .eq("id", session.user.id);

    if (error) {
      console.error("Error updating profile:", error);
      setLoading(false);
      return;
    }

    router.push("/onboarding/partner");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs text-accent font-medium uppercase tracking-wider mb-2">
            Step 1 of 3
          </div>
          <h1 className="text-2xl font-bold">About You</h1>
          <p className="text-sm text-muted mt-2">
            Tell us your name and what you want to achieve.
          </p>
        </div>

        <form onSubmit={handleNext} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent text-sm"
              placeholder="First name"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">
              Your Goal
            </label>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent text-sm resize-none"
              placeholder="Why are you here? What do you want to change?"
              rows={4}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
