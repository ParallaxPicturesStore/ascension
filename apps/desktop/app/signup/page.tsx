"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, syncPartnerLinks } from "@/lib/supabase";
import { Input, Button, AuthLayout } from "@/components/ui";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    // Get the current origin for redirect URL
    const redirectUrl = typeof window !== "undefined" 
      ? `${window.location.origin}/auth/callback`
      : "http://localhost:3001/auth/callback";

    const { data, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: redirectUrl,
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.session?.user?.id) {
      try { await syncPartnerLinks(data.session.user.id); }
      catch (err) { console.error("[Signup] syncPartnerLinks failed:", err); }
      router.replace("/onboarding");
      return;
    }

    // Email confirmation required — show inline confirmation instead of redirecting
    setLoading(false);
    setEmailSent(true);
  }

  return (
    <AuthLayout imageSrc="/login-bg.png">
      <div className="flex-1 flex items-center justify-center px-lg py-2xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          {/* Heading */}
          <div style={{ marginBottom: "var(--spacing-xl)" }}>
            <h1
              style={{
                fontFamily: "var(--font-auth)",
                fontSize: "var(--font-size-auth-heading)",
                fontWeight: "var(--font-weight-auth-heading)",
                lineHeight: "var(--line-height-auth-heading)",
                color: "var(--color-foreground)",
                margin: 0,
              }}
            >
              Ascension
            </h1>
            <p
              style={{
                fontFamily: "var(--font-auth)",
                fontSize: "var(--font-size-auth-body)",
                fontWeight: "var(--font-weight-auth-body)",
                lineHeight: "var(--line-height-auth-body)",
                color: "var(--color-muted)",
                marginTop: "var(--spacing-xs)",
                marginBottom: 0,
              }}
            >
              Start your journey. Take back control.
            </p>
          </div>

          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-base)" }}>
            <Input
              id="email"
              type="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-muted)", lineHeight: 0 }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              }
            />

            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: "var(--color-muted)", lineHeight: 0 }}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
                </button>
              }
            />

            {error && (
              <p
                role="alert"
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-caption)",
                  color: "var(--color-danger)",
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}

            {emailSent ? (
              <p
                style={{
                  fontFamily: "var(--font-auth)",
                  fontSize: "var(--font-size-auth-label)",
                  color: "var(--color-success)",
                  background: "var(--color-success-light)",
                  border: "1px solid var(--color-success)",
                  borderRadius: "var(--radius-card)",
                  padding: "var(--spacing-md) var(--spacing-base)",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                A confirmation email has been sent to <strong>{email}</strong>.
                Please verify your email then sign in.
              </p>
            ) : (
              <Button type="submit" variant="primary" fullWidth loading={loading}>
                Create account
              </Button>
            )}
          </form>

          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-label)",
              color: "var(--color-muted)",
              marginTop: "var(--spacing-2xl)",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--color-accent)" }}
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </AuthLayout>
  );
}
