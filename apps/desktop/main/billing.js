const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

let stripe = null;
let supabase = null;

function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );
  }
  return supabase;
}

// Price IDs - set these after creating products in Stripe Dashboard
const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || null,
  annual: process.env.STRIPE_PRICE_ANNUAL || null,
};

async function createCheckoutSession(userId, userEmail, plan) {
  const client = getStripe();
  if (!client) {
    console.log("[Billing] No Stripe key configured");
    return null;
  }

  const priceId = PRICES[plan];
  if (!priceId) {
    console.error(`[Billing] No price ID for plan: ${plan}`);
    return null;
  }

  try {
    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer_email: userEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: userId },
      },
      success_url: "https://getascension.app/billing/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://getascension.app/billing/cancel",
      metadata: { user_id: userId },
    });

    console.log(`[Billing] Checkout session created: ${session.id}`);
    return session;
  } catch (err) {
    console.error("[Billing] Checkout error:", err.message);
    return null;
  }
}

async function handleWebhookEvent(event) {
  const db = getSupabase();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      if (userId) {
        await db
          .from("users")
          .update({
            stripe_customer_id: session.customer,
            subscription_status: "active",
            subscription_lapse_date: null,
            lapse_reminders_sent: [],
          })
          .eq("id", userId);
        console.log(`[Billing] User ${userId} subscription activated`);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const status = sub.status === "active" || sub.status === "trialing" ? "active" : "cancelled";
      await db
        .from("users")
        .update({ subscription_status: status })
        .eq("stripe_customer_id", sub.customer);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      // Only set lapse_date if not already set (preserve original lapse timestamp)
      const { data: existing } = await db
        .from("users")
        .select("subscription_lapse_date")
        .eq("stripe_customer_id", sub.customer)
        .single();
      const lapseUpdate = {
        subscription_status: "expired",
        ...(existing?.subscription_lapse_date ? {} : { subscription_lapse_date: new Date().toISOString() }),
      };
      await db.from("users").update(lapseUpdate).eq("stripe_customer_id", sub.customer);
      console.log(`[Billing] Subscription deleted for customer ${sub.customer}`);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const { data: existing } = await db
        .from("users")
        .select("subscription_lapse_date")
        .eq("stripe_customer_id", invoice.customer)
        .single();
      const lapseUpdate = {
        subscription_status: "cancelled",
        ...(existing?.subscription_lapse_date ? {} : { subscription_lapse_date: new Date().toISOString() }),
      };
      await db.from("users").update(lapseUpdate).eq("stripe_customer_id", invoice.customer);
      console.log(`[Billing] Payment failed for customer ${invoice.customer}`);
      break;
    }
  }
}

async function getSubscriptionStatus(userId) {
  const { data } = await getSupabase()
    .from("users")
    .select("subscription_status, stripe_customer_id")
    .eq("id", userId)
    .single();

  return data?.subscription_status || "trial";
}

async function createCustomerPortalSession(customerId) {
  const client = getStripe();
  if (!client || !customerId) return null;

  try {
    const session = await client.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://getascension.app",
    });
    return session;
  } catch (err) {
    console.error("[Billing] Portal error:", err.message);
    return null;
  }
}

module.exports = {
  createCheckoutSession,
  handleWebhookEvent,
  getSubscriptionStatus,
  createCustomerPortalSession,
  PRICES,
};
