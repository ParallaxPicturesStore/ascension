"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, syncPartnerLinks } from "@/lib/supabase";
import { getEffectiveSubscriptionStatus } from "@/lib/subscription";
import StreakCounter from "@/components/StreakCounter";
import StatusIndicator from "@/components/StatusIndicator";
import AlertList from "@/components/AlertList";
import { Settings, LogOut, CreditCard, Users, Flame } from "lucide-react";
import SubscriptionGate from "@/components/SubscriptionGate";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  partner_email: string | null;
  stripe_customer_id: string | null;
  subscription_status: string;
  subscription_lapse_date: string | null;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [captureStatus, setCaptureStatus] = useState<
    "active" | "paused" | "stopped"
  >("active");
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [alerts, setAlerts] = useState<
    {
      id: string;
      type: "attempted_access" | "content_detected" | "evasion";
      message: string;
      timestamp: string;
    }[]
  >([]);
  const [weeklyStats, setWeeklyStats] = useState({
    screenshotCount: 0,
    blockedCount: 0,
    flaggedCount: 0,
  });
  const effectiveSubscriptionStatus = getEffectiveSubscriptionStatus(
    user?.subscription_status || "trial",
    user?.subscription_lapse_date || null,
  );

  useEffect(() => {
    checkAuth();
    setupCaptureListener();

    const refreshOnReturn = () => {
      checkAuth();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAuth();
      }
    };

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Remote kill switch — redirect to locked screen if admin disables the account
    if (typeof window !== "undefined" && window.ascension?.onSubscriptionLocked) {
      const unsub = window.ascension.onSubscriptionLocked(() => {
        router.push("/locked");
      });
      return () => {
        window.removeEventListener("focus", refreshOnReturn);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        unsub();
      };
    }

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function checkAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    try {
      await syncPartnerLinks(session.user.id);
    } catch (err) {
      console.error("[Dashboard] Failed to sync partner links:", err);
    }

    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (!profile?.name) {
      router.push("/onboarding");
      return;
    }

    // Notify Electron main process - starts watchdog
    if (typeof window !== "undefined" && window.ascension?.notifyLoggedIn) {
      window.ascension.notifyLoggedIn(
        session.user.id,
        session.access_token,
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
    }

    setUser({
      id: profile.id,
      name: profile.name,
      email: profile.email,
      partner_email: profile.partner_email,
      stripe_customer_id: profile.stripe_customer_id,
      subscription_status: profile.subscription_status,
      subscription_lapse_date: profile.subscription_lapse_date,
    });

    // Fetch streak
    const { data: streakData } = await supabase
      .from("streaks")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (streakData) {
      setStreak({
        current: streakData.current_streak,
        longest: streakData.longest_streak,
      });
    }

    // Fetch recent alerts
    const { data: alertData } = await supabase
      .from("alerts")
      .select("*")
      .eq("user_id", session.user.id)
      .order("timestamp", { ascending: false })
      .limit(5);

    if (alertData) {
      setAlerts(alertData as typeof alerts);
    }

    // Get weekly stats via IPC
    if (typeof window !== "undefined" && window.ascension) {
      const stats = await window.ascension.getWeeklyStats(session.user.id);
      if (stats) setWeeklyStats(stats);
    }

    setLoading(false);
  }

  function setupCaptureListener() {
    if (typeof window !== "undefined" && window.ascension) {
      window.ascension.getCaptureStatus().then((res) => {
        setCaptureStatus(res.status as typeof captureStatus);
      });

      window.ascension.onCaptureEvent((event) => {
        if (event.type === "paused") setCaptureStatus("paused");
        if (event.type === "resumed") setCaptureStatus("active");
        if (event.type === "flagged" || event.type === "immediate_alert") {
          // Refresh data on flag
          checkAuth();
        }
      });
    }
  }

  async function toggleCapture() {
    if (!window.ascension) return;

    if (captureStatus === "active") {
      await window.ascension.pauseCapture();
      setCaptureStatus("paused");
    } else {
      await window.ascension.resumeCapture();
      setCaptureStatus("active");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <SubscriptionGate
      subscriptionStatus={effectiveSubscriptionStatus}
      userId={user?.id ?? null}
      stripeCustomerId={user?.stripe_customer_id ?? null}
      subscriptionLapseDate={user?.subscription_lapse_date ?? null}
    >
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold tracking-[0.1em]">ASCENSION</h1>
          <p className="text-xs text-muted mt-0.5">{user?.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/settings")}
            className="p-2 text-muted hover:text-foreground transition-colors rounded-lg hover:bg-card-bg"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-muted hover:text-foreground transition-colors rounded-lg hover:bg-card-bg"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Streak */}
      <StreakCounter
        currentStreak={streak.current}
        longestStreak={streak.longest}
      />

      {/* Weekly stats row */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-card-bg border border-card-border rounded-xl p-3 text-center">
          <div className="text-lg font-bold tabular-nums">
            {weeklyStats.screenshotCount}
          </div>
          <div className="text-xs text-muted">Scans</div>
        </div>
        <div className="bg-card-bg border border-card-border rounded-xl p-3 text-center">
          <div className="text-lg font-bold tabular-nums text-danger">
            {weeklyStats.flaggedCount}
          </div>
          <div className="text-xs text-muted">Flags</div>
        </div>
        <div className="bg-card-bg border border-card-border rounded-xl p-3 text-center">
          <div className="text-lg font-bold tabular-nums text-warning">
            {weeklyStats.blockedCount}
          </div>
          <div className="text-xs text-muted">Blocked</div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4">
        <StatusIndicator
          status={captureStatus}
          partnerName={user?.partner_email || undefined}
          partnerConnected={!!user?.partner_email}
        />
      </div>

      {/* Pause/Resume button */}
      <button
        onClick={toggleCapture}
        className={`w-full mt-3 py-3 rounded-xl text-sm font-medium transition-colors ${
          captureStatus === "active"
            ? "bg-card-bg border border-card-border text-warning hover:bg-warning/10"
            : "bg-accent hover:bg-accent-hover text-white"
        }`}
      >
        {captureStatus === "active"
          ? "Pause Monitoring"
          : "Resume Monitoring"}
      </button>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={() => router.push("/partner")}
          className="flex items-center gap-2 bg-card-bg border border-card-border rounded-xl p-3 text-sm text-muted hover:text-foreground transition-colors"
        >
          <Users className="w-4 h-4" />
          Partner View
        </button>
        <button
          onClick={() => router.push("/pricing")}
          className="flex items-center gap-2 bg-card-bg border border-card-border rounded-xl p-3 text-sm text-muted hover:text-foreground transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          {effectiveSubscriptionStatus === "active" ? "Plan" : "Upgrade"}
        </button>
      </div>

      {/* Alerts */}
      <div className="mt-4">
        <AlertList alerts={alerts} />
      </div>
    </div>
    </SubscriptionGate>
  );
}
