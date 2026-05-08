"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, syncPartnerLinks } from "@/lib/supabase";
import { getEffectiveSubscriptionStatus } from "@/lib/subscription";
import AlertList from "@/components/AlertList";
import { User } from "lucide-react";
import SubscriptionGate from "@/components/SubscriptionGate";
import Image from "next/image";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  partner_email: string | null;
  stripe_customer_id: string | null;
  partner_id: string | null;
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
    blockedThisWeekCount: 0,
    blockedTotalCount: 0,
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

    // Notify Electron main process - starts watchdog
    // Must happen before any early returns so new users going through
    // onboarding also have an access token in the main process (needed
    // for sending the partner invite email from the onboarding partner page).
    if (typeof window !== "undefined" && window.ascension?.notifyLoggedIn) {
      await window.ascension.notifyLoggedIn(
        session.user.id,
        session.access_token,
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
    }

    if (!profile?.name) {
      router.push("/onboarding");
      return;
    }

    // User has completed basic onboarding (has name) - allow dashboard access
    if (user?.id !== profile.id || user?.name !== profile.name) {
      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        partner_email: profile.partner_email,
        stripe_customer_id: profile.stripe_customer_id,
        partner_id: profile.partner_id,
        subscription_status: profile.subscription_status,
        subscription_lapse_date: profile.subscription_lapse_date,
      });
    }

    // Fetch streak
    const { data: streakData } = await supabase
      .from("streaks")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (streakData) {
      let currentStreak = 0;
      if (streakData.streak_started_at) {
        const start = new Date(streakData.streak_started_at);
        const now = new Date();
        start.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        currentStreak = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }
      setStreak({
        current: currentStreak,
        longest: Math.max(currentStreak, streakData.longest_streak ?? 0),
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
      const stats = await window.ascension.getWeeklyStats(session.user.id) as any;
      console.log("[Dashboard] Weekly stats received:", stats);
      if (stats) {
        setWeeklyStats({
          blockedThisWeekCount: stats.blockedThisWeekCount ?? 0,
          blockedTotalCount: stats.blockedTotalCount ?? 0,
          flaggedCount: stats.flaggedCount ?? 0,
        });
      }
    }

    setLoading(false);
  }

  function setupCaptureListener() {
    if (typeof window !== "undefined" && window.ascension) {
      void window.ascension.getCaptureStatus().then((res) => {
        setCaptureStatus(res.status as typeof captureStatus);
      });

      return window.ascension.onCaptureEvent((event) => {
        if (event.type === "paused") setCaptureStatus("paused");
        if (event.type === "resumed") setCaptureStatus("active");
        if (event.type === "flagged" || event.type === "immediate_alert") {
          // Refresh data on flag
          void checkAuth();
        }
      });
    }

    return () => {};
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
    if (typeof window !== "undefined" && (window as any).ascension?.notifyLoggedOut) {
      await (window as any).ascension.notifyLoggedOut();
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-caption)' }}>Loading...</div>
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
      <div className="min-h-screen relative overflow-hidden" style={{ 
        backgroundColor: 'white'
      }}>
        {/* Header */}
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '36px',
          right: '36px',
          height: '63px',
          backgroundColor: 'white',
          backdropFilter: 'blur(20px)',
          borderRadius: '100px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(217, 221, 229, 0.3)',
          zIndex: 100
        }}>
          <div className="flex items-center" style={{ gap: 'var(--spacing-md)' }}>
            <div className="rounded-full bg-primary flex items-center justify-center" style={{ 
              width: '40px', 
              height: '40px' 
            }}>
              <span className="text-white font-semibold" style={{ 
                fontSize: 'var(--font-size-caption)',
                fontFamily: 'var(--font-auth)'
              }}>
                A
              </span>
            </div>
            <span style={{ 
              fontSize: 'var(--font-size-body)', 
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-foreground)',
              fontFamily: 'var(--font-auth)'
            }}>
              Ascension ally
            </span>
          </div>
          
          <div className="flex items-center" style={{ 
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            gap: 'var(--spacing-xl)'
          }}>
            <button
              onClick={() => router.push("/")}
              style={{ 
                fontSize: 'var(--font-size-caption)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-accent)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-sm) 0',
                fontFamily: 'var(--font-auth)'
              }}
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/settings")}
              className="transition-colors"
              style={{ 
                fontSize: 'var(--font-size-caption)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 'var(--spacing-sm) 0',
                fontFamily: 'var(--font-auth)'
              }}
            >
              Settings
            </button>
          </div>

          <button className="rounded-full bg-primary flex items-center justify-center" style={{ 
            width: '40px', 
            height: '40px',
            border: 'none',
            cursor: 'pointer'
          }}>
            <User className="text-white" style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Main content */}
        <div style={{ 
          padding: '110px var(--spacing-2xl) var(--spacing-2xl)',
          minHeight: '100vh',
          position: 'relative'
        }}>
          {/* Background gradient - full width */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            width: '100%',
            height: '50%',
            backgroundImage: 'url(/home_bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          
          {/* Top section - Dashboard title */}
          <div style={{ position: 'relative', zIndex: 1, paddingTop: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
            {/* Status indicator */}
            <div style={{
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-sm) var(--spacing-base)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              marginBottom: 'var(--spacing-base)'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--color-success)' 
              }} />
              <span style={{ 
                fontSize: 'var(--font-size-caption)', 
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-foreground)',
                fontFamily: 'var(--font-auth)'
              }}>
                Monitoring active
              </span>
            </div>

            {/* Dashboard title */}
            <div>
              <h1 style={{ 
                fontSize: 'var(--font-size-h1)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--color-foreground)',
                marginBottom: 'var(--spacing-sm)',
                margin: 0,
                fontFamily: 'var(--font-auth)',
                lineHeight: 'var(--line-height-h1)'
              }}>
                Dashboard
              </h1>
              <p style={{ 
                fontSize: 'var(--font-size-caption)',
                color: 'var(--color-muted)',
                margin: 0,
                fontFamily: 'var(--font-auth)',
                lineHeight: 'var(--line-height-caption)'
              }}>
                Stay consistent — every day counts.
              </p>
            </div>
          </div>

          {/* Cards grid - Recent alerts and Streak side by side */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '500px 1fr',
            gap: 'var(--spacing-xl)',
            position: 'relative',
            zIndex: 1
          }}>
            {/* Recent alerts card */}
            <div style={{
              backgroundColor: '#F8FAFF',
              backdropFilter: 'blur(10px)',
              borderRadius: 'var(--radius-card)',
              padding: 'var(--spacing-xl)',
              border: '1px solid rgba(217, 221, 229, 0.5)'
            }}>
              <h2 style={{ 
                fontSize: 'var(--font-size-h2)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-foreground)',
                marginBottom: 'var(--spacing-2xl)',
                margin: '0 0 var(--spacing-2xl) 0',
                fontFamily: 'var(--font-auth)',
                lineHeight: 'var(--line-height-h3)'
              }}>
                Recent alerts
              </h2>
              
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 'var(--spacing-3xl)' }}>
                  <div style={{ 
                    width: '100px', 
                    height: '100px', 
                    margin: '0 auto var(--spacing-lg)',
                    position: 'relative'
                  }}>
                    <Image 
                      src="/post_office.png" 
                      alt="No alerts" 
                      width={100} 
                      height={100}
                      style={{ opacity: 0.7 }}
                    />
                  </div>
                  <p style={{ 
                    fontSize: '24px',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-foreground)',
                    marginBottom: 'var(--spacing-xs)',
                    fontFamily: 'var(--font-auth)',
                    lineHeight: 'var(--line-height-body)',
                    margin: '0 0 var(--spacing-xs) 0'
                  }}>
                    No alerts yet
                  </p>
                  <p style={{ 
                    fontSize: '18px',
                    color: 'var(--color-muted)',
                    fontFamily: 'var(--font-auth)',
                    lineHeight: 'var(--line-height-caption)',
                    margin: 0
                  }}>
                    No alerts - keep it up!
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} style={{ 
                      fontSize: 'var(--font-size-caption)',
                      fontFamily: 'var(--font-auth)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                        <span style={{ color: 'var(--color-danger)' }}>•</span>
                        <span style={{ color: 'var(--color-foreground)' }}>{alert.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Streak counter card */}
            <div>
              {/* Days counter card */}
              <div style={{
                backgroundColor: '#F8FAFF',
                backdropFilter: 'blur(10px)',
                borderRadius: 'var(--radius-card)',
                padding: 'var(--spacing-2xl)',
                border: '1px solid rgba(217, 221, 229, 0.5)',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ 
                      fontSize: '96px',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--color-foreground)',
                      lineHeight: 0.9,
                      marginBottom: 'var(--spacing-xs)',
                      fontFamily: 'var(--font-auth)'
                    }}>
                      {streak.current} 
                        <span style={{ 
                      fontSize: '32px',
                    
                      fontFamily: 'var(--font-auth)',
                      lineHeight: 'var(--line-height-body-lg)',
                      fontWeight: 'var(--font-weight-regular)'
                    }}>
                      days
                    </span>
                    </div>
                  
                  </div>
                  <div style={{
                    backgroundColor: 'var(--color-accent-light)',
                    padding: 'var(--spacing-sm) var(--spacing-base)',
                    borderRadius: 'var(--radius-pill)'
                  }}>
                    <span style={{ 
                      fontSize: 'var(--font-size-caption)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-accent)',
                      fontFamily: 'var(--font-auth)'
                    }}>
                      Longest: {streak.longest} days
                    </span>
                  </div>
                </div>
              </div>

              {/* This week section - OUTSIDE the card */}
              <div>
                <h3 style={{ 
                  fontSize: 'var(--font-size-h2 )',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-foreground)',
                  marginBottom: 'var(--spacing-xs)',
                  margin: '0 0 var(--spacing-xs) 0',
                  fontFamily: 'var(--font-auth)',
                  lineHeight: 'var(--line-height-h3)'
                }}>
                  This week
                </h3>
                <p style={{ 
                  fontSize: '18px',
                  color: 'var(--color-muted)',
                  marginBottom: '20px',
                  margin: '0 0 var(--spacing-xl) 0',
                  fontFamily: 'var(--font-auth)',
                  lineHeight: 'var(--line-height-caption)'
                }}>
                  Activity overview for the past 7 days.
                </p>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 'var(--spacing-lg)'
                  }}>
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: '#FAFBFF',
                      borderRadius: 'var(--radius-lg)',
                      padding: '32px 0px 0px 32px',
                      border: '1px solid rgba(217, 221, 229, 0.3)',
                      minHeight: '200px'
                    }}>
                      <div style={{ 
                        fontSize: '48px',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-foreground)',
                        marginBottom: '12px',
                        lineHeight: 1,
                        fontFamily: 'var(--font-auth)'
                      }}>
                        {weeklyStats.blockedThisWeekCount ?? 0}
                      </div>
                      <div style={{ 
                        fontSize: '18px',
                        color: '#111111',
                        marginBottom: 'auto',
                        fontFamily: 'var(--font-auth)',
                        lineHeight: '1.4',
                        fontWeight: 'var(--font-weight-regular)'
                      }}>
                        Blocked this week
                      </div>
                      <div style={{ 
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'flex-end',
                        marginTop: '32px'
                      }}>
                        <Image 
                          src="/first_computer.png" 
                          alt="Blocked" 
                          width={140} 
                          height={140}
                          style={{ opacity: 0.9, objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: '#FAFBFF',
                      borderRadius: 'var(--radius-lg)',
                       padding: '32px 0px 0px 32px',
                      border: '1px solid rgba(217, 221, 229, 0.3)',
                      minHeight: '200px'
                    }}>
                      <div style={{ 
                        fontSize: '48px',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-foreground)',
                        marginBottom: '12px',
                        lineHeight: 1,
                        fontFamily: 'var(--font-auth)'
                      }}>
                        {weeklyStats.blockedTotalCount ?? 0}
                      </div>
                      <div style={{ 
                        fontSize: '18px',
                        color: '#111111',
                        marginBottom: 'auto',
                        fontFamily: 'var(--font-auth)',
                        lineHeight: '1.4',
                        fontWeight: 'var(--font-weight-regular)'
                      }}>
                        Blocked
                      </div>
                      <div style={{ 
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'flex-end',
                        marginTop: '32px'
                      }}>
                        <Image 
                          src="/second_earth.png" 
                          alt="Blocked sites" 
                          width={140} 
                          height={140}
                          style={{ opacity: 0.9, objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: '#F8FAFF',
                      borderRadius: 'var(--radius-lg)',
                        padding: '32px 0px 0px 32px',
                      border: '1px solid rgba(217, 221, 229, 0.3)'
                    }}>
                      <div style={{ 
                        fontSize: '48px',
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--color-foreground)',
                        marginBottom: 'var(--spacing-sm)',
                        lineHeight: 1,
                        fontFamily: 'var(--font-auth)'
                      }}>
                        {weeklyStats.flaggedCount}
                      </div>
                      <div style={{ 
                        fontSize: '18px',
                        color: 'black',
                        marginBottom: 'auto',
                        fontFamily: 'var(--font-auth)',
                        lineHeight: 'var(--line-height-caption)'
                      }}>
                        Flagged
                      </div>
                      <div style={{ 
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'flex-end',
                        marginTop: '32px'
                      }}>
                        <Image 
                          src="/third_flag.png" 
                          alt="Flagged" 
                          width={140} 
                          height={140}
                          style={{ opacity: 0.9, objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
    </SubscriptionGate>
  );
}
