"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { linkPartner, supabase } from "@/lib/supabase";
import { getEffectiveSubscriptionStatus } from "@/lib/subscription";
import { User } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  partner_email: string | null;
  stripe_customer_id: string | null;
  subscription_status: string;
  subscription_lapse_date: string | null;
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
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const effectiveSubscriptionStatus = getEffectiveSubscriptionStatus(
    profile?.subscription_status || "trial",
    profile?.subscription_lapse_date || null,
  );

  useEffect(() => {
    loadProfile(true);

    const refreshOnReturn = () => {
      loadProfile(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadProfile(false);
      }
    };

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function loadProfile(syncFormFields = false) {
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
      const nextProfile = data as UserProfile;
      setProfile(nextProfile);

      if (syncFormFields) {
        setName(nextProfile.name || "");
        setPartnerEmail(nextProfile.partner_email || "");
        setGoals(nextProfile.goals || "");
      }

      setLoading(false);
      return nextProfile;
    }

    setLoading(false);
    return null;
  }

  async function pollForSubscriptionChange(currentStatus: string) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const nextProfile = await loadProfile(false);
      const nextStatus = getEffectiveSubscriptionStatus(
        nextProfile?.subscription_status || "trial",
        nextProfile?.subscription_lapse_date || null,
      );

      if (nextProfile && nextStatus !== currentStatus) {
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSaving(false);
      router.push("/login");
      return;
    }

    const normalizedPartnerEmail = partnerEmail.trim().toLowerCase();
    const currentPartnerEmail = (profile.partner_email || "").trim().toLowerCase();
    const partnerChanged = normalizedPartnerEmail !== currentPartnerEmail;

    const { error: updateError } = await supabase
      .from("users")
      .update({ name, goals })
      .eq("id", profile.id);

    if (!updateError) {
      let linkedPartnerEmail = profile.partner_email;

      try {
        await linkPartner(profile.id, normalizedPartnerEmail || null);
        linkedPartnerEmail = normalizedPartnerEmail || null;

        if (
          partnerChanged &&
          normalizedPartnerEmail &&
          typeof window !== "undefined" &&
          window.ascension?.invitePartner
        ) {
          await window.ascension.invitePartner(
            normalizedPartnerEmail,
            name.trim() || profile.name || "Your partner",
            {
              inviterUserId: profile.id,
              accessToken: session.access_token,
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
              supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            },
          );
        }
      } catch (err) {
        console.error("[Settings] Failed to link partner:", err);
      }

      // Update profile state with new values
      setProfile((current) =>
        current
          ? {
              ...current,
              name,
              goals,
              partner_email: linkedPartnerEmail,
            }
          : current,
      );
    } else {
      console.error("[Settings] Failed to update profile:", updateError);
    }

    setSaving(false);
  }

  async function handleSubscriptionAction() {
    if (!profile) return;

    if (effectiveSubscriptionStatus === "trial") {
      router.push("/pricing");
      return;
    }

    try {
      let customerId = profile.stripe_customer_id;

      if (!customerId) {
        const { data, error } = await supabase
          .from("users")
          .select("stripe_customer_id")
          .eq("id", profile.id)
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
        return;
      }

      void pollForSubscriptionChange(effectiveSubscriptionStatus);
    } catch {
      window.alert("Failed to open subscription portal.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Header - Floating navbar matching Dashboard */}
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
            Dashboard
          </button>
          <button style={{ 
            fontSize: 'var(--font-size-caption)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--spacing-sm) 0',
            fontFamily: 'var(--font-auth)'
          }}>
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

      {/* Content */}
      <div style={{ 
        maxWidth: '720px', 
        margin: '0 auto', 
        padding: '110px var(--spacing-2xl) var(--spacing-2xl)',
        position: 'relative',
        zIndex: 1
      }}>
        <h1 style={{ 
          fontSize: 'var(--font-size-h1)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-foreground)',
          marginBottom: 'var(--spacing-3xl)'
        }}>
          Settings
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2xl)' }}>
          {/* Profile section */}
          <div>
            <h2 style={{ 
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-foreground)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Profile
            </h2>
            <div style={{ 
              backgroundColor: 'var(--color-surface)', 
              borderRadius: 'var(--radius-card)', 
              padding: '0',
              border: '1px solid var(--color-card-border)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '16px 12px 8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                borderBottom: '1px solid var(--color-border)'
              }}>
                <span style={{ 
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-muted)'
                }}>
                  Email
                </span>
                <span style={{ 
                  fontSize: 'var(--font-size-caption)',
                  color: 'var(--color-foreground)'
                }}>
                  {profile?.email || "test@ascension.app"}
                </span>
              </div>
              <div style={{ 
                padding: '16px 12px 8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <span style={{ 
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-muted)'
                }}>
                  Name
                </span>
                {editingName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1, justifyContent: 'flex-end' }}>
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      autoFocus
                      style={{
                        fontSize: 'var(--font-size-caption)',
                        color: 'var(--color-foreground)',
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-accent)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        outline: 'none',
                        fontFamily: 'var(--font-auth)',
                        minWidth: '150px'
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && tempName.trim()) {
                          setSaving(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          if (session && profile) {
                            const { error } = await supabase
                              .from("users")
                              .update({ name: tempName.trim() })
                              .eq("id", profile.id);
                            
                            if (!error) {
                              setName(tempName.trim());
                              setProfile({ ...profile, name: tempName.trim() });
                              setEditingName(false);
                            } else {
                              console.error("[Settings] Failed to update name:", error);
                              alert(`Failed to update name: ${error.message}`);
                            }
                          }
                          setSaving(false);
                        } else if (e.key === 'Escape') {
                          setEditingName(false);
                          setTempName(name);
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        if (tempName.trim()) {
                          setSaving(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          if (session && profile) {
                            const { error } = await supabase
                              .from("users")
                              .update({ name: tempName.trim() })
                              .eq("id", profile.id);
                            
                            if (!error) {
                              setName(tempName.trim());
                              setProfile({ ...profile, name: tempName.trim() });
                              setEditingName(false);
                            } else {
                              console.error("[Settings] Failed to update name:", error);
                              alert(`Failed to update name: ${error.message}`);
                            }
                          }
                          setSaving(false);
                        }
                      }}
                      disabled={saving || !tempName.trim()}
                      style={{ 
                        fontSize: 'var(--font-size-caption)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'white',
                        backgroundColor: 'var(--color-accent)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 12px',
                        cursor: saving || !tempName.trim() ? 'not-allowed' : 'pointer',
                        opacity: saving || !tempName.trim() ? 0.5 : 1
                      }}
                    >
                      {saving ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setTempName(name);
                      }}
                      disabled={saving}
                      style={{ 
                        fontSize: 'var(--font-size-caption)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-muted)',
                        background: 'none',
                        border: 'none',
                        cursor: saving ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <span style={{ 
                      fontSize: 'var(--font-size-caption)',
                      color: 'var(--color-foreground)'
                    }}>
                      {name || "Jamie Test"}
                    </span>
                    <button
                      onClick={() => {
                        setTempName(name);
                        setEditingName(true);
                      }}
                      style={{ 
                        fontSize: 'var(--font-size-caption)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-accent)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Accountability partner section */}
          <div>
            <h2 style={{ 
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-foreground)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Accountability partner
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-tl)' }}>
              <div style={{ 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-card)', 
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                border: '1px solid var(--color-card-border)'
              }}>
                <span style={{ 
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-muted)',
                  whiteSpace: 'nowrap'
                }}>
                  Partner email
                </span>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  style={{
                    fontSize: 'var(--font-size-caption)',
                    color: 'var(--color-foreground)',
                    textAlign: 'right',
                    backgroundColor: 'transparent',
                    border: 'none',
                    outline: 'none',
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'var(--font-auth)'
                  }}
                  placeholder="partner@email.com"
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{ 
                  width: '100%',
                  height: '52px',
                  padding: '0 var(--spacing-2xl)',
                  borderRadius: 'var(--radius-button)',
                  border: '1px solid var(--color-accent)',
                  color: 'var(--color-accent)',
                  backgroundColor: 'transparent',
                  fontWeight: 'var(--font-weight-medium)',
                  fontSize: 'var(--font-size-body)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.5 : 1,
                  transition: 'background-color 0.2s',
                  fontFamily: 'var(--font-auth)'
                }}
                onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = 'var(--color-accent-light)')}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {saving ? "Updating..." : "Update partner"}
              </button>
            </div>
          </div>

          {/* Subscription section */}
          <div>
            <h2 style={{ 
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-foreground)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Subscription
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-tl)' }}>
              <div style={{ 
                backgroundColor: 'var(--color-surface)', 
                borderRadius: 'var(--radius-card)', 
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                border: '1px solid var(--color-card-border)'
              }}>
                <span style={{ 
                  fontSize: 'var(--font-size-caption)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-muted)'
                }}>
                  Status
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--color-warning)',
                    flexShrink: 0
                  }} />
                  <span style={{ 
                    fontSize: 'var(--font-size-caption)',
                    color: 'var(--color-foreground)',
                    textTransform: 'capitalize'
                  }}>
                    {effectiveSubscriptionStatus || "Trial"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSubscriptionAction}
                style={{ 
                  width: '100%',
                  height: '52px',
                  padding: '0 var(--spacing-2xl)',
                  borderRadius: 'var(--radius-button)',
                  backgroundColor: 'var(--color-primary)',
                  color: 'var(--color-on-primary)',
                  border: 'none',
                  fontWeight: 'var(--font-weight-semibold)',
                  fontSize: 'var(--font-size-body)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontFamily: 'var(--font-auth)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
              >
                View plans
              </button>
            </div>
          </div>

          {/* Notifications section */}
          <div>
            <h2 style={{ 
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-foreground)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Notifications
            </h2>
            <div style={{ 
              backgroundColor: 'var(--color-surface)', 
              borderRadius: 'var(--radius-card)', 
              padding: '16px',
              border: '1px solid var(--color-card-border)'
            }}>
              <p style={{ 
                fontSize: 'var(--font-size-caption)',
                lineHeight: 'var(--line-height-body)',
                color: 'var(--color-muted)',
                margin: 0
              }}>
                Push notifications are used to alert you about streak milestones, partner encouragements, and account updates.
              </p>
            </div>
          </div>

          {/* Logout section */}
          <div>
            <h2 style={{ 
              fontSize: 'var(--font-size-h3)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-foreground)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              Account
            </h2>
            <button
              onClick={async () => {
                if (typeof window !== "undefined" && (window as any).ascension?.notifyLoggedOut) {
                  await (window as any).ascension.notifyLoggedOut();
                }
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{ 
                width: '100%',
                height: '52px',
                padding: '0 var(--spacing-2xl)',
                borderRadius: 'var(--radius-button)',
                backgroundColor: 'transparent',
                color: 'var(--color-danger)',
                border: '1px solid var(--color-danger)',
                fontWeight: 'var(--font-weight-medium)',
                fontSize: 'var(--font-size-body)',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                fontFamily: 'var(--font-auth)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-danger-light)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
