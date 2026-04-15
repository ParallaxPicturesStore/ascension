/**
 * API Client for Ascension Desktop
 *
 * All privileged operations (writes that bypass RLS, Stripe, AWS, Resend)
 * are routed through the Supabase Edge Function. The desktop app only
 * needs the anon key for read operations and the user's JWT for writes.
 */

const { createClient } = require("@supabase/supabase-js");

let _db = null;
let _supabaseUrl = null;
let _supabaseAnonKey = null;

/**
 * Called once at login with the Supabase config from the renderer,
 * which always has it embedded at Next.js build time.
 */
function setSupabaseConfig(url, anonKey) {
  _supabaseUrl = typeof url === "string" ? url.trim() : url;
  _supabaseAnonKey = anonKey;
  _db = null; // reset so getDb() recreates with the new config
}

function getSupabaseUrl() {
  const url = _supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof url === "string" ? url.trim() : url;
}

function getSupabaseAnonKey() {
  return _supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
}

/** Anon-key Supabase client — subject to RLS (reads only) */
function getDb() {
  if (!_db && getSupabaseUrl()) {
    _db = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  }
  return _db;
}

/**
 * Call the ascension-api Edge Function with the user's JWT.
 *
 * @param {string} action   — e.g. "screenshots.log", "billing.createCheckout"
 * @param {object} payload  — action-specific data
 * @param {string} accessToken — the user's Supabase access_token (JWT)
 * @returns {Promise<object>} parsed JSON response
 */
async function callEdgeFunction(action, payload, accessToken) {
  const baseurl = getSupabaseUrl();
  const url = `${baseurl.replace(/\/$/, "")}/functions/v1/ascension-api`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Edge Function error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Access-token store ──────────────────────────────────────
// The renderer sends the token after login; all main-process modules
// read it from here so they can call the Edge Function.

let _accessToken = null;

function setAccessToken(token) {
  _accessToken = token;
}

function getAccessToken() {
  return _accessToken;
}

/**
 * Get an authenticated Supabase client using the stored access token.
 */
function getAuthDb() {
  const token = getAccessToken();
  const url = getSupabaseUrl();
  if (!token || !url) return null;

  return createClient(url, getSupabaseAnonKey(), {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

module.exports = {
  getDb,
  getAuthDb,
  callEdgeFunction,
  setAccessToken,
  getAccessToken,
  setSupabaseConfig,
};
