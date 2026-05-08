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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <p className="text-xs font-medium tracking-[0.2em] text-muted mb-16 uppercase">ASCENSION</p>

      {/* Icon - 3D warning triangle */}
      <div className="w-24 h-24 mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-300 to-blue-400 rounded-2xl transform rotate-12 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-2xl transform -rotate-6" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-white relative z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-3">Access suspended</h1>
      <p className="text-sm text-muted leading-relaxed max-w-md mb-12">
        Your Ascension subscription has ended. Renew to restore full monitoring and your partner&apos;s dashboard access.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={handleRenew}
          className="w-full py-3.5 rounded-full bg-primary hover:bg-primaryHover text-white font-semibold text-sm transition-colors"
        >
          Renew subscription
        </button>
        <p className="text-xs text-muted">
          On-device site blocking continues while suspended.
        </p>
      </div>
    </div>
  );
}
