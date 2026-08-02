"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, Eye, EyeOff, MoveRight, Sparkles } from "lucide-react";
import Link from "next/link";

type AuthMode = "login" | "signup";

export default function AuthLanding({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const [mode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    void fetch(`/api/auth/${isSignup ? "signup" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const data = (await response.json()) as { error?: string; requiresEmailConfirmation?: boolean };
        if (!response.ok) throw new Error(data.error || "We could not complete authentication.");
        if (data.requiresEmailConfirmation) {
          setSubmitted(true);
          return;
        }
        window.location.assign("/");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "We could not complete authentication."))
      .finally(() => setLoading(false));
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <Link className="auth-brand" href="/" aria-label="MakeMyShow home">
            <span className="auth-brand-mark">M</span>
            <span>MakeMyShow</span>
          </Link>

          <div className="auth-form-wrap">
            <div className="auth-intro">
              <p className="auth-eyebrow"><Sparkles size={13} /> The show starts here</p>
              <h1>{isSignup ? "Make your next show happen." : "Welcome back."}</h1>
              <p>{isSignup ? "Build your profile and help artists find the audience waiting for them." : "Pick up where you left off and keep the live music moving."}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication options">
              <Link className={mode === "login" ? "active" : ""} href="/login" role="tab" aria-selected={mode === "login"}>Log in</Link>
              <Link className={mode === "signup" ? "active" : ""} href="/signup" role="tab" aria-selected={mode === "signup"}>Sign up</Link>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && (
                <label>
                  Full name
                  <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
                </label>
              )}
              <label>
                Email address
                <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              </label>
              <label>
                Password
                <span className="auth-password-field">
                  <input name="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {isSignup && <label className="auth-check"><input type="checkbox" required /> <span>I agree to the terms and privacy policy.</span></label>}
              {!isSignup && <button className="auth-forgot" type="button">Forgot password?</button>}
              <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Connecting..." : isSignup ? "Create account" : "Log in"}<ArrowUpRight size={18} /></button>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {submitted && <p className="auth-status" role="status">Check your email to confirm your account, then log in.</p>}
            </form>

            <p className="auth-switch">{isSignup ? "Already have an account?" : "New to MakeMyShow?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link></p>
          </div>

          <p className="auth-footer">© 2026 MakeMyShow <span>·</span> For fans, artists, and the rooms between them.</p>
        </div>
      </section>

      <section className="auth-visual" aria-label="A live show waiting to happen">
        <div className="auth-visual-top"><span>01 / 04</span><span>Live demand, made visible</span></div>
        <div className="auth-art">
          <div className="auth-art-image" />
          <div className="auth-sun" />
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-note note-top"><span>Audience signal</span><strong>Ready when you are.</strong></div>
          <div className="auth-note note-bottom"><small>Next city to light up</small><strong>Hyderabad ↗</strong><span>2,418 potential fans</span></div>
          <div className="auth-word">SHOW<br /><em>UP</em></div>
        </div>
        <div className="auth-visual-bottom">
          <div><span>MakeMyShow</span><strong>Turn interest<br />into a room full.</strong></div>
          <MoveRight size={28} strokeWidth={1.2} />
        </div>
      </section>
    </main>
  );
}
