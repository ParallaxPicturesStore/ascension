"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LockedPage() {
  const router = useRouter();

  // Listen for the kill switch being lifted (e.g. admin re-enables)
  useEffect(() => {
    if (typeof window === "undefined" || !window.ascension) return;
    // If they somehow navigate here without being locked, go home
  }, []);

  function handleRenew() {
    if (typeof window !== "undefined" && window.ascension) {
      window.ascension.openExternal("https://getascension.app/pricing");
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <p className="text-xs font-bold tracking-[0.3em] text-accent mb-12">ASCENSION</p>

      {/* Icon */}
      <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-warning"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>

      <h1 className="text-xl font-bold mb-3">Access Suspended</h1>
      <p className="text-sm text-muted leading-relaxed max-w-xs mb-8">
        Your Ascension subscription has ended. Renew to restore full monitoring and your
        partner&apos;s dashboard access.
      </p>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={handleRenew}
          className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold text-sm transition-colors"
        >
          Renew Subscription
        </button>
        <p className="text-xs text-muted">
          On-device site blocking continues while suspended.
        </p>
      </div>
    </div>
  );
}
