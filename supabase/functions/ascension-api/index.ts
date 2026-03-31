/**
 * Supabase Edge Function: Ascension API
 * Handles operations that require service_role (elevated) permissions.
 *
 * URL: https://flrllorqzmbztvtccvab.supabase.co/functions/v1/ascension-api
 *
 * All requests are POST with JSON body:
 *   { "action": "screenshots.log", "payload": { ... } }
 *
 * The caller's JWT is verified to extract the authenticated user ID.
 * The service_role key is used server-side for writes that bypass RLS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

// ── Supabase clients ────────────────────────────────────────

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

/** Service-role client — bypasses RLS */
const adminDb = createClient(supabaseUrl, serviceRoleKey);

/** Anon client used only to verify the caller's JWT */
const anonDb = createClient(supabaseUrl, anonKey);

// ── Stripe (lazy) ───────────────────────────────────────────

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!_stripe) {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return null;
    _stripe = new Stripe(key, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  return _stripe;
}

// Price IDs from env
const PRICES: Record<string, string | undefined> = {
  monthly: Deno.env.get("STRIPE_PRICE_MONTHLY"),
  annual: Deno.env.get("STRIPE_PRICE_ANNUAL"),
};

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

// ── Action handlers ─────────────────────────────────────────

type ActionHandler = (
  payload: Record<string, unknown>,
  callerId: string,
) => Promise<Response>;

const actions: Record<string, ActionHandler> = {
  // ── screenshots.log ──
  "screenshots.log": async (payload, callerId) => {
    const { user_id, timestamp, rekognition_score, flagged, labels } = payload as {
      user_id: string;
      timestamp: string;
      rekognition_score: number;
      flagged: boolean;
      labels: string[] | null;
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
  "billing.createCheckout": async (payload, _callerId) => {
    const { user_id, email, plan } = payload as {
      user_id: string;
      email: string;
      plan: string;
    };

    const stripe = getStripe();
    if (!stripe) return errorResponse("Stripe not configured", 500);

    const priceId = PRICES[plan];
    if (!priceId) return errorResponse(`Unknown plan: ${plan}`, 400);

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: 7,
          metadata: { user_id },
        },
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
  "billing.createPortalSession": async (payload, _callerId) => {
    const { customer_id } = payload as { customer_id: string };

    const stripe = getStripe();
    if (!stripe || !customer_id) return jsonResponse(null);

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
};

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
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
