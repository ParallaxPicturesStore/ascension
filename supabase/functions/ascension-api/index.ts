/**
 * Supabase Edge Function: Ascension API
 * Handles operations that require service_role (elevated) permissions.
 *
 * URL: {SUPABASE_URL}/functions/v1/ascension-api
 *
 * All requests are POST with JSON body:
 *   { "action": "screenshots.log", "payload": { ... } }
 *
 * The caller's JWT is verified to extract the authenticated user ID.
 * The service_role key is used server-side for writes that bypass RLS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// NOTE: @aws-sdk/client-rekognition is intentionally NOT imported at the top level.
// The SDK pulls in deno.land/std@0.177.1 Node.js polyfills that register a
// `beforeunload` handler using Deno.core.runMicrotasks(), which is no longer
// supported in the Supabase Edge Function Deno runtime and crashes the isolate
// on every cold start — breaking ALL actions, not just rekognition.analyze.
// It is dynamically imported inside the action instead.

// ── Supabase clients ────────────────────────────────────────

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/** Service-role client — bypasses RLS */
const adminDb = createClient(supabaseUrl, serviceRoleKey);

/** Anon client used only to verify the caller's JWT */
const anonDb = createClient(supabaseUrl, anonKey);

// ── Stripe (lazy) ───────────────────────────────────────────

let _stripe: any = null;

async function getStripe() {
  if (_stripe) return _stripe;

  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return null;

  const StripeMod = await import("https://esm.sh/stripe@14.21.0?target=deno");
  const Stripe = StripeMod.default;

  _stripe = new Stripe(key, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  return _stripe;
}

// Price IDs from env
const PRICES: Record<string, string | undefined> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
  annual: Deno.env.get("STRIPE_PRICE_ANNUAL"),
};

// ── AWS Rekognition (lazy) ─────────────────────────────────

const FLAGGED_CATEGORIES = [
  "Explicit Nudity",
  "Nudity",
  "Suggestive",
  "Sexual Activity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Violence",
];

// getRekognition() removed — Rekognition client is now created via dynamic import
// inside the rekognition.analyze action to avoid Deno cold-start crash caused by
// Node.js polyfills in @aws-sdk calling Deno.core.runMicrotasks() at module load time.

// ── Resend (email) ─────────────────────────────────────────

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type TemplateEntry = {
  subject: (name: string) => string;
  html: (name: string, data: Record<string, unknown>) => string;
};

const EMAIL_TEMPLATES: Record<string, TemplateEntry> = {
  attempted_access: {
    subject: (name: string) => `${name} attempted to access blocked content`,
    html: (name: string, data: Record<string, unknown>) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          At <strong>${data.time}</strong> on <strong>${data.date}</strong>, ${name} attempted to access an adult website.
        </p>
        <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #6b6560;">
            The attempt was <strong style="color: #22c55e;">blocked successfully</strong>.
          </p>
          ${data.url ? `<p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">URL: ${escapeHtml(String(data.url))}</p>` : ""}
        </div>
        <p style="font-size: 14px; color: #6b6560;">You may want to check in with ${name}.</p>
      </div>
    `,
  },

  content_detected: {
    subject: (name: string) => `${name} - content flagged on screen`,
    html: (name: string, data: Record<string, unknown>) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          Ascension detected potentially explicit content on <strong>${name}</strong>'s screen at <strong>${data.time}</strong> on <strong>${data.date}</strong>.
        </p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #991b1b;">
            Confidence: <strong>${data.confidence}%</strong>
          </p>
          ${data.labels ? `<p style="margin: 8px 0 0; font-size: 13px; color: #94a3b8;">Labels: ${escapeHtml(String(data.labels))}</p>` : ""}
        </div>
        <p style="font-size: 14px; color: #6b6560;">A blurred screenshot is available in your partner dashboard.</p>
      </div>
    `,
  },

  evasion: {
    subject: (name: string) => `Warning: ${name} - Ascension was disabled`,
    html: (name: string, data: Record<string, unknown>) => `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          Ascension was <strong>${data.action}</strong> on <strong>${name}</strong>'s device at <strong>${data.time}</strong> on <strong>${data.date}</strong>.
        </p>
        <div style="background: #fff7ed; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #9a3412;">
            This may warrant a conversation.
          </p>
        </div>
      </div>
    `,
  },

  partner_invitation: {
    subject: (name: string) => `${name} added you as their accountability partner`,
    html: (name: string, data: Record<string, unknown>) => {
      const inviteCode = data.inviteCode ? escapeHtml(String(data.inviteCode)) : "";
      return `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
          <strong>${name}</strong> has chosen you as their accountability partner on Ascension.
        </p>
        <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 14px; color: #1a1a1a; font-weight: 600;">What this means:</p>
          <ul style="margin: 0; padding-left: 16px; font-size: 14px; color: #6b6560; line-height: 1.8;">
            <li>You'll receive alerts if flagged content is detected on their screen</li>
            <li>You'll be notified if they attempt to access blocked content</li>
            <li>You'll get a weekly progress report every Monday</li>
            <li>You'll be alerted if the app is disabled</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #6b6560; margin-bottom: 24px;">
          Create your free partner account to view their dashboard and full activity history.
        </p>
        ${inviteCode ? `
        <div style="background: #eef5ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.6px; color: #1e3a8a; font-weight: 700; text-transform: uppercase;">Invite Code</p>
          <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 700; word-break: break-all;">${inviteCode}</p>
          <p style="margin: 10px 0 0; font-size: 12px; color: #475569;">Use this code in the Ascension Ally app after you sign in.</p>
        </div>
        ` : ""}
        <div style="text-align: center;">
          <a href="${data.signupUrl}" style="display: inline-block; background: #1a3a5c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Set Up Your Account
          </a>
        </div>
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
          You'll continue to receive alert emails regardless of whether you create an account.
        </p>
      </div>
    `;
    },
  },

  subscription_lapse: {
    subject: () => `Your Ascension subscription has expired`,
    html: (name: string, data: Record<string, unknown>) => {
      const messages: Record<string, { headline: string; body: string; urgency: string }> = {
        day1: {
          headline: "Your subscription has expired",
          body: "Your Ascension subscription ended today. Your accountability partner will no longer receive alerts if AI-powered monitoring is reduced.",
          urgency: "Renew now to keep your partner fully informed and maintain your streak.",
        },
        day7: {
          headline: "7 days without accountability",
          body: "It's been a week since your Ascension subscription expired. Your AI-powered screen monitoring is still active for now, but time is running out.",
          urgency: "Don't let a lapse in subscription become a lapse in your progress.",
        },
        day14: {
          headline: "2 weeks - AI monitoring ending soon",
          body: "Your subscription expired 14 days ago. In 16 days, AI-powered content detection will be reduced as your grace period ends.",
          urgency: "Renew before day 30 to keep full monitoring active.",
        },
        day30: {
          headline: "AI monitoring has ended",
          body: "Your 30-day grace period has ended. AI-powered content verification is now offline. Basic on-device monitoring continues, but your partner's alerts may be less reliable.",
          urgency: "Renew today to restore full protection.",
        },
      };
      const key = String(data.key || "day1");
      const msg = messages[key] || messages.day1;
      return `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
          </div>
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">${msg.headline}</h2>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hi ${name},</p>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">${msg.body}</p>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #9a3412;">${msg.urgency}</p>
          </div>
          <div style="text-align: center;">
            <a href="https://getascension.app/pricing" style="display: inline-block; background: #1a3a5c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
              Renew Subscription
            </a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            On-device monitoring and site blocking continue regardless of subscription status.
          </p>
        </div>
      `;
    },
  },

  subscription_lapse_partner: {
    subject: (name: string) => `${name}'s Ascension subscription has expired`,
    html: (name: string, data: Record<string, unknown>) => {
      const messages: Record<string, string> = {
        day1: `${name}'s Ascension subscription expired today. AI-powered monitoring may be reduced if they don't renew.`,
        day7: `It's been 7 days since ${name}'s subscription expired. Consider checking in with them about renewing.`,
        day14: `${name}'s subscription has been expired for 14 days. AI monitoring will stop in 16 days if they don't renew.`,
        day30: `${name}'s 30-day grace period has ended. AI-powered content detection is now offline for their account. Ask them to renew to restore full accountability.`,
      };
      const key = String(data.key || "day1");
      const body = messages[key] || messages.day1;
      return `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 14px; letter-spacing: 3px; color: #1a3a5c; margin: 0;">ASCENSION</h1>
          </div>
          <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">${body}</p>
          <div style="background: #f8f7f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 14px; color: #6b6560;">
              On-device site blocking on ${name}'s device continues regardless of subscription.
            </p>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px;">
            You're receiving this as ${name}'s accountability partner on Ascension.
          </p>
        </div>
      `;
    },
  },
};

async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Ascension <alerts@getascension.app>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Resend ${res.status}: ${text}` };
  }

  const result = await res.json();
  return { success: true, id: result.id };
}

// ── Auth helper ─────────────────────────────────────────────

async function getCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anonDb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// ── CORS headers ────────────────────────────────────────────

// SECURITY: Restrict CORS to known origins. Update this list when adding new
// client domains. The wildcard "*" was removed to prevent cross-origin abuse.
const ALLOWED_ORIGINS = new Set([
  "https://getascension.app",
  "https://www.getascension.app",
  "http://localhost:3001", // dev
]);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Backward-compat alias used by helper functions — set per-request in handler
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ── Partner link helpers ────────────────────────────────────

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

async function setPartnerLink(userId: string, partnerEmail: string | null) {
  const { data: user, error: userError } = await adminDb
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("User not found");
  }

  const normalizedUserEmail = normalizeEmail(user.email);
  const normalizedPartnerEmail = normalizeEmail(partnerEmail);

  if (!normalizedPartnerEmail) {
    const { data: cleared, error: clearError } = await adminDb
      .from("users")
      .update({
        partner_email: null,
        partner_id: null,
      })
      .eq("id", userId)
      .select("partner_id, partner_email")
      .single();

    if (clearError) throw new Error(clearError.message);

    return {
      partner_id: cleared.partner_id,
      partner_email: cleared.partner_email,
      pending: false,
    };
  }

  if (normalizedUserEmail && normalizedPartnerEmail === normalizedUserEmail) {
    throw new Error("You cannot be your own partner");
  }

  const { data: partner, error: partnerLookupError } = await adminDb
    .from("users")
    .select("id")
    .eq("email", normalizedPartnerEmail)
    .maybeSingle();

  if (partnerLookupError) {
    throw new Error(partnerLookupError.message);
  }

  const { data: updated, error: updateError } = await adminDb
    .from("users")
    .update({
      partner_email: normalizedPartnerEmail,
      partner_id: partner?.id ?? null,
    })
    .eq("id", userId)
    .select("partner_id, partner_email")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    partner_id: updated.partner_id,
    partner_email: updated.partner_email,
    pending: partner == null,
  };
}

async function syncPartnerLinksForUser(userId: string) {
  const { data: user, error: userError } = await adminDb
    .from("users")
    .select("id, email, partner_email")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("User not found");
  }

  const normalizedEmail = normalizeEmail(user.email);
  if (!normalizedEmail) {
    return {
      linked_users: 0,
      partner_id: null,
      partner_email: user.partner_email,
      pending: false,
    };
  }

  const { data: linkedUsers, error: backfillError } = await adminDb
    .from("users")
    .update({
      partner_id: userId,
      partner_email: normalizedEmail,
    })
    .eq("partner_email", normalizedEmail)
    .neq("id", userId)
    .select("id");

  if (backfillError) {
    throw new Error(backfillError.message);
  }

  const ownLink = await setPartnerLink(userId, user.partner_email);

  return {
    linked_users: linkedUsers?.length ?? 0,
    partner_id: ownLink.partner_id,
    partner_email: ownLink.partner_email,
    pending: ownLink.pending,
  };
}

// ── Action handlers ─────────────────────────────────────────

type ActionHandler = (
  payload: Record<string, unknown>,
  callerId: string,
) => Promise<Response>;

const actions: Record<string, ActionHandler> = {
  // ── screenshots.log ──
  "screenshots.log": async (payload, callerId) => {
    const { user_id, timestamp, rekognition_score, flagged, labels, file_path, partner_id } = payload as {
      user_id: string;
      timestamp: string;
      rekognition_score: number;
      flagged: boolean;
      labels: string[] | null;
      file_path?: string;
      partner_id?: string;
    };

    if (!user_id) return errorResponse("user_id is required", 400);

    // Callers can only log screenshots for themselves
    if (user_id !== callerId) {
      return errorResponse("Cannot log screenshots for another user", 403);
    }

    const { error } = await adminDb.from("screenshots").insert({
      user_id,
      timestamp,
      rekognition_score,
      flagged,
      labels,
      file_path: file_path || null,
      partner_id: partner_id || null,
    });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── alerts.create ──
  "alerts.create": async (payload, callerId) => {
    const { user_id, partner_id, type, message } = payload as {
      user_id: string;
      partner_id: string;
      type: string;
      message: string;
    };

    if (!user_id || !partner_id || !type || !message) {
      return errorResponse("user_id, partner_id, type, and message are required", 400);
    }

    // Callers can only create alerts for themselves
    if (user_id !== callerId) {
      return errorResponse("Cannot create alerts for another user", 403);
    }

    const { error } = await adminDb.from("alerts").insert({
      user_id,
      partner_id,
      type,
      message,
    });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── streaks.reset ──
  "streaks.reset": async (payload, callerId) => {
    const { user_id } = payload as { user_id: string };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot reset another user's streak", 403);

    // Read current streak
    const { data: current, error: readErr } = await adminDb
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", user_id)
      .single();

    if (readErr && readErr.code !== "PGRST116") return errorResponse(readErr.message, 500);
    if (!current) return errorResponse("No streak record found", 404);

    const now = new Date().toISOString();
    const longestStreak = Math.max(
      current?.longest_streak ?? 0,
      current?.current_streak ?? 0,
    );

    const { data: updated, error: writeErr } = await adminDb
      .from("streaks")
      .update({
        current_streak: 0,
        last_relapse_date: now,
        longest_streak: longestStreak,
        updated_at: now,
      })
      .eq("user_id", user_id)
      .select()
      .single();

    if (writeErr) return errorResponse(writeErr.message, 500);
    return jsonResponse(updated);
  },

  // ── streaks.increment ──
  "streaks.increment": async (payload, callerId) => {
    const { user_id } = payload as { user_id: string };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot modify another user's streak", 403);

    const { data: current, error: readErr } = await adminDb
      .from("streaks")
      .select("current_streak, longest_streak")
      .eq("user_id", user_id)
      .single();

    if (readErr) return errorResponse(readErr.message, 500);
    if (!current) return errorResponse("No streak record found", 404);

    const newStreak = current.current_streak + 1;
    const { data: updated, error: writeErr } = await adminDb
      .from("streaks")
      .update({
        current_streak: newStreak,
        longest_streak: Math.max(current.longest_streak, newStreak),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id)
      .select()
      .single();

    if (writeErr) return errorResponse(writeErr.message, 500);
    return jsonResponse(updated);
  },

  // ── billing.createCheckout ──
  "billing.createCheckout": async (payload, callerId) => {
    const { user_id, email, plan } = payload as {
      user_id: string;
      email: string;
      plan: string;
    };

    // Callers can only create checkouts for themselves
    if (user_id !== callerId) {
      return errorResponse("Cannot create checkout for another user", 403);
    }

    const stripe = await getStripe();
    if (!stripe) return errorResponse("Stripe not configured", 500);

    const priceId = PRICES[plan];
    if (!priceId) return errorResponse(`Unknown plan: ${plan}`, 400);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url:
          "https://getascension.app/billing/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://getascension.app/billing/cancel",
        metadata: { user_id },
      });

      return jsonResponse({ url: session.url, error: null });
    } catch (err) {
      return jsonResponse({ url: null, error: (err as Error).message });
    }
  },

  // ── billing.createPortalSession ──
  "billing.createPortalSession": async (payload, callerId) => {
    const { customer_id } = payload as { customer_id: string };

    const stripe = await getStripe();
    if (!stripe || !customer_id) return jsonResponse(null);

    // Verify the caller owns this Stripe customer ID
    const { data: owner } = await adminDb
      .from("users")
      .select("id")
      .eq("stripe_customer_id", customer_id)
      .single();
    if (!owner || owner.id !== callerId) {
      return errorResponse("Cannot access another user's billing portal", 403);
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customer_id,
        return_url: "https://getascension.app",
      });
      return jsonResponse({ url: session.url });
    } catch (err) {
      console.error("[API] Portal session error:", (err as Error).message);
      return jsonResponse(null);
    }
  },

  // ── rekognition.analyze ──
  "rekognition.analyze": async (payload, _callerId) => {
    const { base64Image } = payload as { base64Image: string };

    if (!base64Image) return errorResponse("base64Image is required", 400);

    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
    if (!accessKeyId || !secretAccessKey) {
      // No AWS credentials — return clean result (dev mode)
      console.log("[API] No AWS credentials — skipping Rekognition analysis");
      return jsonResponse({ labels: [], maxConfidence: 0, raw: [] });
    }

    try {
      // Dynamic import — avoids Deno cold-start crash from Node.js polyfills
      // in @aws-sdk calling Deno.core.runMicrotasks() at module load time.
      const { RekognitionClient, DetectModerationLabelsCommand } = await import(
        "npm:@aws-sdk/client-rekognition@3.540.0"
      );

      const client = new RekognitionClient({
        region: Deno.env.get("AWS_REGION") ?? "us-east-1",
        credentials: { accessKeyId, secretAccessKey },
      });

      // Decode base64 to Uint8Array
      const binaryStr = atob(base64Image);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const command = new DetectModerationLabelsCommand({
        Image: { Bytes: bytes },
        MinConfidence: 50,
      });

      const response = await client.send(command);
      const labels = response.ModerationLabels ?? [];

      // Filter to only flagged categories
      const relevant = labels.filter((label) =>
        FLAGGED_CATEGORIES.some(
          (cat) =>
            label.Name?.includes(cat) || label.ParentName?.includes(cat),
        ),
      );

      const maxConfidence =
        relevant.length > 0
          ? Math.max(...relevant.map((l) => l.Confidence ?? 0))
          : 0;

      return jsonResponse({
        labels: relevant.map(
          (l) => `${l.Name} (${(l.Confidence ?? 0).toFixed(1)}%)`,
        ),
        maxConfidence,
        raw: labels,
      });
    } catch (err) {
      console.error("[API] Rekognition error:", (err as Error).message);
      return jsonResponse({
        labels: [],
        maxConfidence: 0,
        raw: [],
        error: (err as Error).message,
      });
    }
  },

  // ── alerts.sendEmail ──
  "alerts.sendEmail": async (payload, _callerId) => {
    const { type, to, userName, data } = payload as {
      type: string;
      to: string;
      userName: string;
      data: Record<string, unknown>;
    };

    if (!type || !to || !userName) {
      return errorResponse("type, to, and userName are required", 400);
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return errorResponse("Invalid email address", 400);
    }

    const template = EMAIL_TEMPLATES[type];
    if (!template) {
      return errorResponse(`Unknown email template: ${type}`, 400);
    }

    const now = new Date();
    const enrichedData: Record<string, unknown> = {
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      date: now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
      ...data,
    };

    const subject = template.subject(userName);
    const html = template.html(userName, enrichedData);

    const result = await sendEmailViaResend(to, subject, html);
    if (!result.success) {
      console.error(`[API] Email send failed: ${result.error}`);
      return errorResponse(result.error ?? "Email send failed", 500);
    }

    return jsonResponse({ success: true, id: result.id });
  },

  // ── subscription.updateReminders ──
  "subscription.updateReminders": async (payload, callerId) => {
    const { user_id, lapse_reminders_sent } = payload as {
      user_id: string;
      lapse_reminders_sent: string[];
    };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot update another user's data", 403);

    const { error } = await adminDb
      .from("users")
      .update({ lapse_reminders_sent })
      .eq("id", user_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── subscription.setLapseDate ──
  "subscription.setLapseDate": async (payload, callerId) => {
    const { user_id, lapse_date } = payload as {
      user_id: string;
      lapse_date: string;
    };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot update another user's data", 403);

    const { error } = await adminDb
      .from("users")
      .update({ subscription_lapse_date: lapse_date })
      .eq("id", user_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── subscription.clearLapse ──
  "subscription.clearLapse": async (payload, callerId) => {
    const { user_id } = payload as { user_id: string };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot update another user's data", 403);

    const { error } = await adminDb
      .from("users")
      .update({ subscription_lapse_date: null, lapse_reminders_sent: [] })
      .eq("id", user_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── watchdog.heartbeat ──
  "watchdog.heartbeat": async (payload, callerId) => {
    const { user_id } = payload as { user_id: string };

    if (!user_id) return errorResponse("user_id is required", 400);
    if (user_id !== callerId) return errorResponse("Cannot send heartbeat for another user", 403);

    const { error } = await adminDb
      .from("users")
      .update({ last_heartbeat: new Date().toISOString() })
      .eq("id", user_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── user.setQuitPassword ──
  "user.setQuitPassword": async (payload, callerId) => {
    const { user_id, password_hash } = payload as {
      user_id: string;
      password_hash: string;
    };

    if (!user_id || !password_hash) {
      return errorResponse("user_id and password_hash are required", 400);
    }
    if (user_id !== callerId) {
      return errorResponse("Cannot set password for another user", 403);
    }

    const { error } = await adminDb
      .from("users")
      .update({ partner_password_hash: password_hash })
      .eq("id", user_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true });
  },

  // ── users.linkPartner ──
  "users.linkPartner": async (payload, callerId) => {
    const { user_id, partner_email } = payload as {
      user_id: string;
      partner_email: string | null;
    };

    if (!user_id) {
      return errorResponse("user_id is required", 400);
    }

    if (user_id !== callerId) {
      return errorResponse("Cannot link partner for another user", 403);
    }

    try {
      const result = await setPartnerLink(user_id, partner_email ?? null);
      return jsonResponse({ success: true, ...result });
    } catch (err) {
      return errorResponse((err as Error).message, 400);
    }
  },

  // ── users.syncPartnerLinks ──
  "users.syncPartnerLinks": async (payload, callerId) => {
    const { user_id } = payload as { user_id: string };

    if (!user_id) {
      return errorResponse("user_id is required", 400);
    }

    if (user_id !== callerId) {
      return errorResponse("Cannot sync partner links for another user", 403);
    }

    try {
      const result = await syncPartnerLinksForUser(user_id);
      return jsonResponse({ success: true, ...result });
    } catch (err) {
      return errorResponse((err as Error).message, 400);
    }
  },
};

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  // Set CORS headers per-request based on Origin
  corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Verify caller identity
  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return errorResponse("Unauthorized", 401);
  }

  let body: { action: string; payload: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { action, payload } = body;
  if (!action || !payload) {
    return errorResponse("Missing action or payload", 400);
  }

  const handler = actions[action];
  if (!handler) {
    return errorResponse(`Unknown action: ${action}`, 400);
  }

  try {
    return await handler(payload, callerId);
  } catch (err) {
    console.error(`[API] Error in ${action}:`, (err as Error).message);
    return errorResponse("Internal error", 500);
  }
});
