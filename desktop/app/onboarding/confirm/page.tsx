"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function OnboardingConfirm() {
  const router = useRouter();
  const [quitPassword, setQuitPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (quitPassword.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (quitPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }

    if (typeof window !== "undefined" && window.ascension?.setQuitPassword) {
      const result = await window.ascension.setQuitPassword(session.user.id, quitPassword);
      if (!result.success) {
        setError(result.error || "Failed to set password");
        setLoading(false);
        return;
      }
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-xs text-accent font-medium uppercase tracking-wider mb-2">
            Step 3 of 3
          </div>

          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-success/10 mb-5">
            <Shield className="w-8 h-8 text-success" />
          </div>

          <h1 className="text-2xl font-bold">Set Your Quit Password</h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            This password is required to close Ascension. Share it with your
            partner — not yourself. Closing without it sends them an alert.
          </p>
        </div>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">
              Quit Password
            </label>
            <input
              type="password"
              value={quitPassword}
              onChange={(e) => setQuitPassword(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent text-sm"
              placeholder="Choose a password"
              required
              minLength={4}
            />
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-card-bg border border-card-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent text-sm"
              placeholder="Confirm password"
              required
            />
          </div>

          <div className="bg-card-bg border border-card-border rounded-xl p-4 space-y-2.5">
            {[
              "Your screen is continuously monitored in the background",
              "AI analyses your screen for explicit content",
              "Your data is handled securely and privately",
              "Closing the app alerts your partner",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-success" />
                </div>
                <p className="text-sm text-foreground">{item}</p>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading || !quitPassword || !confirmPassword}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3.5 rounded-lg transition-colors text-sm"
          >
            <Lock className="w-4 h-4 inline mr-2" />
            {loading ? "Setting up..." : "Begin Monitoring"}
          </button>
        </form>
      </div>
    </div>
  );
}
