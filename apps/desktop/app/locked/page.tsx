"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function LockedPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !window.ascension) return;
  }, []);

  async function handleRenew() {
    try {
      // Get the user's Stripe customer ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("[Locked] No session found");
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("stripe_customer_id")
        .eq("id", session.user.id)
        .single();

      if (userError || !userData?.stripe_customer_id) {
        console.error("[Locked] No Stripe customer ID found");
        // If no Stripe customer, navigate to pricing page within app
        router.push("/pricing");
        return;
      }

      // Open Stripe billing portal for existing customers
      if (typeof window !== "undefined" && window.ascension) {
        const result = await window.ascension.openBillingPortal(userData.stripe_customer_id);
        if (!result?.success) {
          console.error("[Locked] Failed to open billing portal");
          router.push("/pricing");
        }
      } else {
        // Fallback: navigate to pricing page
        router.push("/pricing");
      }
    } catch (error) {
      console.error("[Locked] Error opening billing portal:", error);
      router.push("/pricing");
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-surface)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-2xl)',
      textAlign: 'center',
      fontFamily: 'var(--font-auth)'
    }}>
      {/* Logo */}
      <p style={{
        fontSize: '0.75rem',
        fontWeight: 'var(--font-weight-medium)',
        letterSpacing: '0.2em',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--spacing-3xl)',
        textTransform: 'uppercase'
      }}>
        ASCENSION
      </p>

      {/* Alert Icon */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <Image 
          src="/icons/alert.png" 
          alt="Alert" 
          width={120} 
          height={120}
        />
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: 'var(--font-size-h1)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-foreground)',
        marginBottom: 'var(--spacing-base)',
        fontFamily: 'var(--font-auth)',
        lineHeight: 'var(--line-height-h1)'
      }}>
        Access suspended
      </h1>

      {/* Description */}
      <p style={{
        fontSize: 'var(--font-size-body-lg)',
        fontWeight: 'var(--font-weight-regular)',
        color: 'var(--color-text-secondary)',
        lineHeight: 'var(--line-height-body-lg)',
        maxWidth: '26.25rem',
        marginBottom: 'var(--spacing-2xl)',
        fontFamily: 'var(--font-auth)',
        opacity: '0.7'
      }}>
        Your Ascension subscription has ended. Renew to restore full monitoring and your partner&apos;s dashboard access.
      </p>

      {/* Button */}
      <div style={{ width: '100%', maxWidth: 'var(--form-width)' }}>
        <button
          onClick={handleRenew}
          style={{
            width: '100%',
            height: 'var(--button-height)',
            borderRadius: 'var(--radius-button)',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontWeight: 'var(--font-weight-semibold)',
            fontSize: 'var(--font-size-body)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            fontFamily: 'var(--font-auth)',
            marginBottom: 'var(--spacing-base)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
        >
          Renew subscription
        </button>
        
        {/* Footer text */}
        <p style={{
          fontSize: 'var(--font-size-body)',
          fontWeight: 'var(--font-weight-regular)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-auth)',
          marginTop: 'var(--spacing-base)'
        }}>
          On-device site blocking continues while suspended.
        </p>
      </div>
    </div>
  );
}
