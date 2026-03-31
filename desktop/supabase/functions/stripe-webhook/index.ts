/**
 * Supabase Edge Function: Stripe Webhook Handler
 * URL: https://flrllorqzmbztvtccvab.supabase.co/functions/v1/stripe-webhook
 *
 * Register this URL in Stripe Dashboard → Developers → Webhooks → Add endpoint
 * Events to listen for:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 */

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("[Webhook] Missing signature or webhook secret");
    return new Response("Unauthorized", { status: 401 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`[Webhook] Received: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (userId) {
          await supabase
            .from("users")
            .update({
              stripe_customer_id: session.customer,
              subscription_status: "active",
              subscription_lapse_date: null,
              lapse_reminders_sent: [],
            })
            .eq("id", userId);
          console.log(`[Webhook] User ${userId} activated`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          sub.status === "active" || sub.status === "trialing" ? "active" : "cancelled";

        const update: Record<string, unknown> = { subscription_status: status };

        // If reactivating, clear lapse data
        if (status === "active") {
          update.subscription_lapse_date = null;
          update.lapse_reminders_sent = [];
        }

        await supabase.from("users").update(update).eq("stripe_customer_id", sub.customer);
        console.log(`[Webhook] Subscription updated to ${status} for customer ${sub.customer}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        // Only set lapse_date if not already set (preserve the original timestamp)
        const { data: existing } = await supabase
          .from("users")
          .select("subscription_lapse_date")
          .eq("stripe_customer_id", sub.customer)
          .single();

        const lapseUpdate: Record<string, unknown> = { subscription_status: "expired" };
        if (!existing?.subscription_lapse_date) {
          lapseUpdate.subscription_lapse_date = new Date().toISOString();
        }

        await supabase.from("users").update(lapseUpdate).eq("stripe_customer_id", sub.customer);
        console.log(`[Webhook] Subscription deleted for customer ${sub.customer}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const { data: existing } = await supabase
          .from("users")
          .select("subscription_lapse_date")
          .eq("stripe_customer_id", invoice.customer)
          .single();

        const lapseUpdate: Record<string, unknown> = { subscription_status: "cancelled" };
        if (!existing?.subscription_lapse_date) {
          lapseUpdate.subscription_lapse_date = new Date().toISOString();
        }

        await supabase.from("users").update(lapseUpdate).eq("stripe_customer_id", invoice.customer as string);
        console.log(`[Webhook] Payment failed for customer ${invoice.customer}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Webhook] Handler error for ${event.type}:`, err.message);
    return new Response("Internal error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
