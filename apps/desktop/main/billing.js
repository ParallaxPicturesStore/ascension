/**
 * Billing module — all Stripe operations are routed through the Edge Function.
 * No Stripe secret key is needed on the client.
 */

const { getDb, callEdgeFunction, getAccessToken } = require("./api-client");

async function createCheckoutSession(userId, userEmail, plan) {
  const token = getAccessToken();
  if (!token) {
    console.log("[Billing] No access token — cannot create checkout");
    return null;
  }

  try {
    const result = await callEdgeFunction(
      "billing.createCheckout",
      { user_id: userId, email: userEmail, plan },
      token
    );

    if (result?.url) {
      console.log(`[Billing] Checkout session created`);
      return { url: result.url };
    }
    if (result?.error) {
      console.error("[Billing] Checkout error:", result.error);
    }
    return null;
  } catch (err) {
    console.error("[Billing] Checkout error:", err.message);
    return null;
  }
}

async function getSubscriptionStatus(userId) {
  // Read via anon key — RLS allows users to read their own row
  const db = getDb();
  if (!db) return "trial";

  const { data } = await db
    .from("users")
    .select("subscription_status, stripe_customer_id")
    .eq("id", userId)
    .single();

  return data?.subscription_status || "trial";
}

async function createCustomerPortalSession(customerId) {
  const token = getAccessToken();
  if (!token || !customerId) return null;

  try {
    const result = await callEdgeFunction(
      "billing.createPortalSession",
      { customer_id: customerId },
      token
    );
    return result?.url ? { url: result.url } : null;
  } catch (err) {
    console.error("[Billing] Portal error:", err.message);
    return null;
  }
}

module.exports = {
  createCheckoutSession,
  getSubscriptionStatus,
  createCustomerPortalSession,
};
