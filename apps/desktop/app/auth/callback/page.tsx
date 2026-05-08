"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/ui";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    const inElectron = typeof window !== "undefined" && window.ascension !== undefined;
    setIsElectron(inElectron);

    async function handleCallback() {
      try {
        // Get the session after email confirmation
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("[Auth Callback] Error:", error);
          setStatus("error");
          return;
        }

        if (session) {
          console.log("[Auth Callback] Session confirmed");
          setStatus("success");
          
          if (inElectron) {
            // Running in Electron - redirect to onboarding
            setTimeout(() => {
              router.replace("/onboarding");
            }, 1500);
          }
          // If in browser, show message to return to app
        } else {
          setStatus("error");
        }
      } catch (err) {
        console.error("[Auth Callback] Exception:", err);
        setStatus("error");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <div className="flex-1 flex items-center justify-center px-lg py-2xl">
        <div
          style={{
            width: "100%",
            maxWidth: "var(--form-width)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {status === "loading" && (
            <>
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "50%",
                  border: "3px solid var(--color-accent-light)",
                  borderTopColor: "var(--color-accent)",
                  animation: "spin 1s linear infinite",
                  marginBottom: "var(--spacing-lg)",
                }}
              />
              <h1
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-heading)",
                  fontWeight: "var(--font-weight-auth-heading)",
                  color: "var(--color-foreground)",
                  margin: 0,
                }}
              >
                Confirming your email...
              </h1>
            </>
          )}

          {status === "success" && (
            <>
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-success-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--spacing-lg)",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-success)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-heading)",
                  fontWeight: "var(--font-weight-auth-heading)",
                  color: "var(--color-foreground)",
                  margin: 0,
                }}
              >
                Email confirmed!
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-body)",
                  color: "var(--color-muted)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                {isElectron 
                  ? "Redirecting you to complete setup..."
                  : "Please return to the Ascension desktop app and sign in to continue."}
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "50%",
                  backgroundColor: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--spacing-lg)",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-danger)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-heading)",
                  fontWeight: "var(--font-weight-auth-heading)",
                  color: "var(--color-foreground)",
                  margin: 0,
                }}
              >
                Confirmation failed
              </h1>
              <p
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-body)",
                  color: "var(--color-muted)",
                  marginTop: "var(--spacing-xs)",
                  marginBottom: "var(--spacing-lg)",
                }}
              >
                Please close this window and return to the Ascension app to sign in.
              </p>
            </>
          )}

          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </div>
    </AuthLayout>
  );
}
