"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, syncPartnerLinks } from "@/lib/supabase";
import { Input, Button, AuthLayout } from "@/components/ui";
import { EyeIcon, EyeOffIcon, CheckIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsConfirm = searchParams.get("confirm") === "1";

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  // Derived — no extra state needed
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Skip login form if session already exists
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user?.id) {
      try { await syncPartnerLinks(data.user.id); }
      catch (err) { console.error("[Login] syncPartnerLinks failed:", err); }
    }

    router.push("/");
  }

  return (
    <AuthLayout imageSrc="/login-bg.png">
      {/* ── Form panel ── */}
      <div className="flex-1 flex items-center justify-center px-lg py-2xl">
        <div style={{ width: "100%", maxWidth: "var(--form-width)" }}>

          {/* Heading block */}
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
              Welcome back. Stay the course.
            </p>
          </div>

          {/* Email-confirmation notice */}
          {needsConfirm && (
            <div
              style={{
                background: "var(--color-accent-light)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-card)",
                color: "var(--color-accent)",
                fontFamily: "var(--font-auth)",
                fontSize: "var(--font-size-auth-label)",
                padding: "var(--spacing-md) var(--spacing-base)",
                marginBottom: "var(--spacing-lg)",
                textAlign: "center",
              }}
            >
              Check your email and click the confirmation link, then sign in below.
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-base)" }}>
            {/* Email */}
            <Input
              id="email"
              type="email"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@ascension.app"
              required
              rightIcon={
                emailValid
                  ? <CheckIcon size={20} style={{ color: "var(--color-success)" }} />
                  : null
              }
            />

            {/* Password */}
            <div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
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
              {/* Forgot password */}
              <div className="flex justify-end" style={{ marginTop: "var(--spacing-xs)" }}>
                <Link
                  href="/forgot-password"
                  className="transition-opacity hover:opacity-70"
                  style={{
                    fontFamily: "var(--font-auth)",
                    fontSize: "var(--font-size-auth-label)",
                    color: "var(--color-accent)",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Auth error */}
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

            <Button type="submit" variant="primary" fullWidth loading={loading}>
              Sign in
            </Button>
          </form>

          {/* Sign-up link */}
          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-auth)",
              fontSize: "var(--font-size-auth-label)",
              color: "var(--color-muted)",
              marginTop: "var(--spacing-2xl)",
            }}
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--color-accent)" }}
            >
              Sign up
            </Link>
          </p>

        </div>
      </div>
    </AuthLayout>
  );
}
