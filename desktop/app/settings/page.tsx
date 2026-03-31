"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  User,
  Shield,
  CreditCard,
  Bell,
  Monitor,
  Lock,
  LogOut,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  partner_email: string | null;
  subscription_status: string;
  goals: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [goals, setGoals] = useState("");
  const [quitPassword, setQuitPassword] = useState("");
  const [quitError, setQuitError] = useState("");
  const [quitting, setQuitting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (data) {
      setProfile(data as UserProfile);
      setName(data.name || "");
      setPartnerEmail(data.partner_email || "");
      setGoals(data.goals || "");
    }
    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);

    await supabase
      .from("users")
      .update({ name, partner_email: partnerEmail, goals })
      .eq("id", profile.id);

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-xl font-bold mb-6">Settings</h1>

      {/* Profile section */}
      <div className="space-y-4">
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Profile</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full bg-background/50 border border-card-border rounded-lg px-3 py-2.5 text-sm text-muted"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">
                Your Goal
              </label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Partner section */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Accountability Partner</h2>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Partner&apos;s Email
            </label>
            <input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent"
              placeholder="partner@email.com"
            />
          </div>
        </div>

        {/* Monitoring section */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Monitoring</h2>
          </div>
          <div className="space-y-2 text-sm text-muted">
            <div className="flex justify-between">
              <span>Screen monitoring</span>
              <span className="text-foreground">Continuous</span>
            </div>
            <div className="flex justify-between">
              <span>Flag threshold</span>
              <span className="text-foreground">70% confidence</span>
            </div>
            <div className="flex justify-between">
              <span>Immediate alert</span>
              <span className="text-foreground">90% confidence</span>
            </div>
          </div>
        </div>

        {/* Subscription section */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Subscription</h2>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm capitalize">
                {profile?.subscription_status || "Trial"}
              </div>
              <div className="text-xs text-muted">Current plan</div>
            </div>
            <button
              onClick={() => router.push("/pricing")}
              className="text-xs text-accent hover:underline"
            >
              {profile?.subscription_status === "active"
                ? "Manage"
                : "Upgrade"}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold">Notifications</h2>
          </div>
          <div className="space-y-2 text-sm text-muted">
            <div className="flex justify-between">
              <span>Content flag alerts</span>
              <span className="text-success">On</span>
            </div>
            <div className="flex justify-between">
              <span>Evasion alerts</span>
              <span className="text-success">On</span>
            </div>
            <div className="flex justify-between">
              <span>Weekly summary</span>
              <span className="text-success">On</span>
            </div>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {/* Quit section */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <LogOut className="w-4 h-4 text-danger" />
            <h2 className="text-sm font-semibold">Quit Ascension</h2>
          </div>
          <p className="text-xs text-muted mb-3">
            Enter your quit password to close the app. Your partner will be
            notified.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={quitPassword}
              onChange={(e) => {
                setQuitPassword(e.target.value);
                setQuitError("");
              }}
              className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-danger"
              placeholder="Enter quit password"
            />
            <button
              onClick={async () => {
                setQuitting(true);
                setQuitError("");
                if (typeof window !== "undefined" && window.ascension) {
                  const result = await window.ascension.quitApp(quitPassword);
                  if (!result.success) {
                    setQuitError(result.error || "Incorrect password");
                  }
                }
                setQuitting(false);
              }}
              disabled={quitting || !quitPassword}
              className="bg-danger/10 hover:bg-danger/20 disabled:opacity-50 text-danger font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {quitting ? "..." : "Quit"}
            </button>
          </div>
          {quitError && (
            <p className="text-xs text-danger mt-2">{quitError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
