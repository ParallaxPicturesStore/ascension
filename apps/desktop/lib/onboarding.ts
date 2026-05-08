import { supabase } from "./supabase";

/**
 * Onboarding step tracking — inferred from existing user data, no new DB column needed.
 * Steps: signup → step1 (name/goals) → step2 (partner) → step3 (confirm) → pricing → permissions → complete
 */

export type OnboardingStep =
  | "step1"       // /onboarding — name + goals
  | "step2"       // /onboarding/partner
  | "step3"       // /onboarding/confirm
  | "pricing"     // /pricing
  | "permissions" // /onboarding/permissions
  | "complete";   // done

const STEP_ROUTES: Record<OnboardingStep, string> = {
  step1: "/onboarding",
  step2: "/onboarding/partner",
  step3: "/onboarding/confirm",
  pricing: "/pricing",
  permissions: "/onboarding/permissions",
  complete: "/",
};

/**
 * Infer the user's current onboarding step from existing DB fields.
 * No new column needed — we check what's filled in.
 */
export async function getCurrentOnboardingStep(userId: string): Promise<OnboardingStep | null> {
  const { data } = await supabase
    .from("users")
    .select("name, goals, partner_email")
    .eq("id", userId)
    .single();

  if (!data) return null;

  // Check localStorage for explicit step override (user manually navigated forward)
  const savedStep = loadOnboardingStep();
  if (savedStep) return savedStep;

  // Infer from DB data
  if (!data.name) return "step1";
  if (!data.goals) return "step1";
  if (!data.partner_email) return "step2";
  
  // Name + goals + partner filled → they've completed the 3 onboarding steps
  // Check if they've seen pricing/permissions yet
  return "step3";
}

/**
 * Get the route path for a given onboarding step.
 */
export function getStepRoute(step: OnboardingStep): string {
  return STEP_ROUTES[step];
}

/**
 * Check if onboarding is complete (user has name + goals).
 * If incomplete, returns the route they should be redirected to.
 * If complete, returns null.
 */
export async function getOnboardingRedirect(userId: string): Promise<string | null> {
  const step = await getCurrentOnboardingStep(userId);
  if (!step || step === "complete") return null;
  return getStepRoute(step);
}

// ── localStorage helpers for step tracking and form persistence ───────────────

const STORAGE_KEY_STEP = "ascension_onboarding_current_step";
const STORAGE_KEY_PREFIX = "ascension_onboarding_";

/**
 * Save the current onboarding step to localStorage.
 * This overrides DB inference — useful when user skips ahead (e.g. skip partner).
 */
export function saveOnboardingStep(step: OnboardingStep) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_STEP, step);
  } catch (err) {
    console.error("[Onboarding] Failed to save step:", err);
  }
}

/**
 * Load the saved onboarding step from localStorage.
 */
export function loadOnboardingStep(): OnboardingStep | null {
  if (typeof window === "undefined") return null;
  try {
    const step = localStorage.getItem(STORAGE_KEY_STEP);
    return step as OnboardingStep | null;
  } catch (err) {
    console.error("[Onboarding] Failed to load step:", err);
    return null;
  }
}

/**
 * Clear the saved onboarding step (call when onboarding completes).
 */
export function clearOnboardingStep() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_STEP);
  } catch (err) {
    console.error("[Onboarding] Failed to clear step:", err);
  }
}

/**
 * Save form data for a specific step to localStorage.
 */
export function saveFormData(step: string, data: Record<string, any>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${step}`, JSON.stringify(data));
  } catch (err) {
    console.error("[Onboarding] Failed to save form data:", err);
  }
}

/**
 * Load form data for a specific step from localStorage.
 */
export function loadFormData<T = Record<string, any>>(step: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${step}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("[Onboarding] Failed to load form data:", err);
    return null;
  }
}

/**
 * Clear form data for a specific step.
 */
export function clearFormData(step: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${step}`);
  } catch (err) {
    console.error("[Onboarding] Failed to clear form data:", err);
  }
}

/**
 * Clear all onboarding data (step + all form data).
 * Call when onboarding completes.
 */
export function clearAllOnboardingData() {
  if (typeof window === "undefined") return;
  try {
    clearOnboardingStep();
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.error("[Onboarding] Failed to clear onboarding data:", err);
  }
}
