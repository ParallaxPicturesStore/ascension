"use client";

/**
 * Central auth gate — mirrors mobile's app/_layout.tsx AuthGate.
 * Handles all redirect logic in one place so individual pages don't need to.
 *
 * Rules (simplified):
 *  - No session → /login
 *  - Session + no name → /onboarding
 *  - Session + name → allow access to app
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  clearAllOnboardingData,
} from "@/lib/onboarding";

const AUTH_ROUTES = ["/login", "/signup"];
const ONBOARDING_ROUTES = [
  "/onboarding",
  "/onboarding/partner",
  "/onboarding/confirm",
  "/pricing",
  "/onboarding/permissions",
  "/onboarding/protected",
];

interface AuthContextValue {
  /** Call after onboarding completes so the gate doesn't redirect back */
  completeOnboarding: () => void;
}

const AuthContext = createContext<AuthContextValue>({ completeOnboarding: () => {} });
export function useAuthGate() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const onboardingDone = useRef(false);

  const completeOnboarding = useCallback(() => {
    onboardingDone.current = true;
    clearAllOnboardingData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (cancelled) return;

      const inAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
      const inOnboarding = ONBOARDING_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

      // No session → send to login
      if (!session) {
        if (!inAuthRoute) router.replace("/login");
        setChecked(true);
        return;
      }

      // Has session — check if profile has name (basic onboarding complete)
      const { data: profile } = await supabase
        .from("users")
        .select("name")
        .eq("id", session.user.id)
        .single();

      if (cancelled) return;

      const needsOnboarding = !profile?.name;

      // Needs onboarding — redirect to /onboarding unless already there
      if (needsOnboarding && !onboardingDone.current) {
        if (!inOnboarding) router.replace("/onboarding");
        setChecked(true);
        return;
      }

      // Has completed basic onboarding (has name) — redirect away from auth pages only
      // Allow them to stay on onboarding pages if they want to complete them
      if (!needsOnboarding && inAuthRoute) {
        router.replace("/");
      }

      setChecked(true);
    }

    checkAuth();

    // Re-run on auth state changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) checkAuth();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  // Show nothing until the first auth check completes — prevents flash of wrong page
  if (!checked) return null;

  return (
    <AuthContext.Provider value={{ completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}
