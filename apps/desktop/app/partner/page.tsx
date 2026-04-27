"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Shield,
  Eye,
  AlertTriangle,
  Clock,
  TrendingUp,
  Ban,
  LogOut,
} from "lucide-react";

interface PartnerUser {
  id: string;
  name: string;
  email: string;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface BlockedAttempt {
  id: string;
  url: string;
  timestamp: string;
  browser: string | null;
  blocked_successfully: boolean;
}

interface Streak {
  current_streak: number;
  longest_streak: number;
  last_relapse_date: string | null;
  streak_started_at: string | null;
}

export default function PartnerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerUser | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [blocked, setBlocked] = useState<BlockedAttempt[]>([]);
  const [tab, setTab] = useState<"overview" | "alerts" | "blocked">("overview");

  useEffect(() => {
    loadPartnerData();
  }, []);

  async function loadPartnerData() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    // Find the user I'm partnered with (where I'm their partner)
    const { data: users } = await supabase
      .from("users")
      .select("*")
      .eq("partner_id", session.user.id);

    if (!users || users.length === 0) {
      // Check if they have partner_email matching my email
      const { data: byEmail } = await supabase
        .from("users")
        .select("*")
        .eq("partner_email", session.user.email);

      if (!byEmail || byEmail.length === 0) {
        setLoading(false);
        return;
      }
      setPartner({ id: byEmail[0].id, name: byEmail[0].name, email: byEmail[0].email });

      await loadData(byEmail[0].id);
    } else {
      setPartner({ id: users[0].id, name: users[0].name, email: users[0].email });
      await loadData(users[0].id);
    }

    setLoading(false);
  }

  async function loadData(userId: string) {
    const [streakRes, alertsRes, blockedRes] = await Promise.all([
      supabase.from("streaks").select("*").eq("user_id", userId).single(),
      supabase
        .from("alerts")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("blocked_attempts")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(50),
    ]);

    if (streakRes.data) setStreak(streakRes.data);
    if (alertsRes.data) setAlerts(alertsRes.data as Alert[]);
    if (blockedRes.data) setBlocked(blockedRes.data as BlockedAttempt[]);
  }

  async function markAlertRead(alertId: string) {
    await supabase.from("alerts").update({ read: true }).eq("id", alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function streakDays(startedAt: string | null): number {
    if (!startedAt) return 0;
    const start = new Date(startedAt);
    const now = new Date();
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen bg-background p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-8"
        >
          ← Back
        </button>
        <div className="flex flex-col items-center justify-center flex-1 text-center mt-16">
          <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold">No Partner Linked</h2>
          <p className="text-sm text-muted mt-2">
            Nobody has added you as their accountability partner yet.
          </p>
        </div>
      </div>
    );
  }

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground mb-1"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold tracking-[0.1em]">ASCENSION</h1>
          <p className="text-xs text-muted mt-0.5">
            Partner Dashboard - {partner.name}
          </p>
        </div>
        <button
          onClick={async () => {
            if (typeof window !== "undefined" && (window as any).ascension?.notifyLoggedOut) {
              await (window as any).ascension.notifyLoggedOut();
            }
            await supabase.auth.signOut();
            router.push("/login");
          }}
          className="p-2 text-muted hover:text-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Streak card */}
      <div className="bg-card-bg border border-card-border rounded-xl p-6 text-center mb-6">
        <div className="text-5xl font-bold tabular-nums">
          {streakDays(streak?.streak_started_at ?? null)}
        </div>
        <div className="text-muted text-xs mt-1 uppercase tracking-wider">
          days clean
        </div>
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center">
            <TrendingUp className="w-4 h-4 text-accent mx-auto mb-1" />
            <div className="text-sm font-semibold">{Math.max(streakDays(streak?.streak_started_at ?? null), streak?.longest_streak ?? 0)}</div>
            <div className="text-xs text-muted">Best</div>
          </div>
          <div className="text-center">
            <Clock className="w-4 h-4 text-muted mx-auto mb-1" />
            <div className="text-sm font-semibold">
              {streak?.last_relapse_date
                ? formatTime(streak.last_relapse_date)
                : "Never"}
            </div>
            <div className="text-xs text-muted">Last relapse</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card-bg rounded-lg p-1 mb-4">
        {(["overview", "alerts", "blocked"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
              tab === t
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t === "alerts" ? `Alerts${unreadCount > 0 ? ` (${unreadCount})` : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-3">
          <div className="bg-card-bg border border-card-border rounded-xl p-4 flex items-center gap-3">
            <Eye className="w-5 h-5 text-accent shrink-0" />
            <div>
              <div className="text-sm font-medium">Monitoring Active</div>
              <div className="text-xs text-muted">
                Screen activity is continuously monitored
              </div>
            </div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <div>
              <div className="text-sm font-medium">
                {alerts.filter((a) => a.type === "content_detected").length} Content Flags
              </div>
              <div className="text-xs text-muted">All time</div>
            </div>
          </div>
          <div className="bg-card-bg border border-card-border rounded-xl p-4 flex items-center gap-3">
            <Ban className="w-5 h-5 text-danger shrink-0" />
            <div>
              <div className="text-sm font-medium">
                {blocked.length} Blocked Attempts
              </div>
              <div className="text-xs text-muted">All time</div>
            </div>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted">No alerts. All clear.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => !alert.read && markAlertRead(alert.id)}
                className={`w-full text-left bg-card-bg border rounded-xl p-4 transition-colors ${
                  alert.read
                    ? "border-card-border opacity-60"
                    : "border-warning/30 bg-warning/5"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      alert.type === "content_detected"
                        ? "text-danger"
                        : alert.type === "evasion"
                        ? "text-warning"
                        : "text-accent"
                    }`}
                  >
                    {alert.type === "content_detected"
                      ? "Content Flagged"
                      : alert.type === "evasion"
                      ? "Evasion"
                      : "Blocked Access"}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-foreground/80">{alert.message}</p>
                {!alert.read && (
                  <span className="text-xs text-accent mt-1 inline-block">
                    Tap to mark as read
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {tab === "blocked" && (
        <div className="space-y-2">
          {blocked.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted">No blocked attempts.</p>
            </div>
          ) : (
            blocked.map((b) => (
              <div
                key={b.id}
                className="bg-card-bg border border-card-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-danger">
                    Blocked
                  </span>
                  <span className="text-xs text-muted">
                    {formatTime(b.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 font-mono truncate">
                  {b.url}
                </p>
                {b.browser && (
                  <p className="text-xs text-muted mt-1">{b.browser}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
