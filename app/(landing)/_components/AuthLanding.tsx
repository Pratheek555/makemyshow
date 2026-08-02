"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, BadgeCheck, Eye, EyeOff, MicVocal, MoveRight, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";

type AuthMode = "login" | "signup";
type AuthAudience = "fan" | "artist";

export default function AuthLanding({ initialMode = "login", audience = "fan" }: { initialMode?: AuthMode; audience?: AuthAudience }) {
  const [mode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isSignup = mode === "signup";
  const isArtist = audience === "artist";
  const loginPath = isArtist ? "/artist/login" : "/login";
  const signupPath = isArtist ? "/artist/signup" : "/signup";
  const destination = isArtist ? "/artist/dashboard" : "/dashboard";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      accountType: audience,
      artistProfile: isArtist
        ? {
            artistName: String(formData.get("artistName") ?? ""),
            representativeRole: String(formData.get("representativeRole") ?? ""),
            category: String(formData.get("category") ?? ""),
            baseCity: String(formData.get("baseCity") ?? ""),
            socialLink: String(formData.get("socialLink") ?? ""),
          }
        : undefined,
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
        window.location.assign(destination);
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
              <p className="auth-eyebrow">{isArtist ? <MicVocal size={13} /> : <Sparkles size={13} />} {isArtist ? "Artist backstage" : "The show starts here"}</p>
              <h1>{isArtist ? (isSignup ? "Claim your artist room." : "Back to backstage.") : isSignup ? "Make your next show happen." : "Welcome back."}</h1>
              <p>
                {isArtist
                  ? isSignup
                    ? "Create a verified profile, submit shows, and turn city demand into a cleaner booking plan."
                    : "Manage your shows, audience signals, bookings, and payouts from one quiet control room."
                  : isSignup
                    ? "Build your profile and help artists find the audience waiting for them."
                    : "Pick up where you left off and keep the live music moving."}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication options">
              <Link className={mode === "login" ? "active" : ""} href={loginPath} role="tab" aria-selected={mode === "login"}>Log in</Link>
              <Link className={mode === "signup" ? "active" : ""} href={signupPath} role="tab" aria-selected={mode === "signup"}>Sign up</Link>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && (
                <label>
                  Full name
                  <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
                </label>
              )}

              {isArtist && isSignup && (
                <div className="artist-signup-grid" aria-label="Artist profile basics">
                  <label>
                    Artist or stage name
                    <input name="artistName" type="text" placeholder="e.g. The Local Set" autoComplete="organization" required />
                  </label>
                  <label>
                    I am signing up as
                    <select name="representativeRole" defaultValue="Solo artist" required>
                      <option>Solo artist</option>
                      <option>Band member</option>
                      <option>Artist manager</option>
                      <option>Organizer representative</option>
                    </select>
                  </label>
                  <label>
                    Category
                    <select name="category" defaultValue="Music" required>
                      <option>Music</option>
                      <option>Comedy</option>
                      <option>Theatre</option>
                      <option>Dance</option>
                      <option>Speaker</option>
                      <option>DJ</option>
                    </select>
                  </label>
                  <label>
                    Base city
                    <input name="baseCity" type="text" placeholder="Hyderabad" autoComplete="address-level2" required />
                  </label>
                  <label className="artist-signup-wide">
                    Social or proof link
                    <input name="socialLink" type="url" placeholder="Instagram, YouTube, Spotify, or website" autoComplete="url" required />
                  </label>
                </div>
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

              {isArtist && isSignup && <label className="auth-check"><input type="checkbox" required /> <span>I confirm I represent this artist or have permission to manage this profile.</span></label>}
              {isSignup && <label className="auth-check"><input type="checkbox" required /> <span>I agree to the terms and privacy policy.</span></label>}
              {!isSignup && (
                <button
                  className="auth-forgot"
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("Password reset is not enabled in this demo yet. Use an existing account or create a new one.");
                  }}
                >
                  Forgot password?
                </button>
              )}
              <button className="auth-submit" type="submit" disabled={loading}>{loading ? "Connecting..." : isArtist && isSignup ? "Submit artist profile" : isSignup ? "Create account" : "Log in"}<ArrowUpRight size={18} /></button>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {notice && <p className="auth-status" role="status">{notice}</p>}
              {submitted && <p className="auth-status" role="status">Check your email to confirm your account, then log in. Your artist profile will stay in review until verification is complete.</p>}
            </form>

            <p className="auth-switch">{isSignup ? "Already have an account?" : isArtist ? "New artist on MakeMyShow?" : "New to MakeMyShow?"} <Link href={isSignup ? loginPath : signupPath}>{isSignup ? "Log in" : "Create an account"}</Link></p>
            <p className="auth-switch artist-auth-switch">
              {isArtist ? <UserRound size={14} /> : <BadgeCheck size={14} />}
              <Link href={isArtist ? "/login" : "/artist/login"}>{isArtist ? "Continue as a fan" : "Artist login"}</Link>
            </p>
          </div>

          <p className="auth-footer">(c) 2026 MakeMyShow <span>*</span> For fans, artists, and the rooms between them.</p>
        </div>
      </section>

      <section className="auth-visual" aria-label="A live show waiting to happen">
        <div className="auth-visual-top"><span>{isArtist ? "Artist OS" : "01 / 04"}</span><span>{isArtist ? "Verification, shows, payouts" : "Live demand, made visible"}</span></div>
        <div className="auth-art">
          <div className="auth-art-image" />
          <div className="auth-sun" />
          <div className="auth-orbit orbit-one" />
          <div className="auth-orbit orbit-two" />
          <div className="auth-note note-top"><span>{isArtist ? "Verification" : "Audience signal"}</span><strong>{isArtist ? "Pending review." : "Ready when you are."}</strong></div>
          <div className="auth-note note-bottom"><small>{isArtist ? "Next show window" : "Next city to light up"}</small><strong>{isArtist ? "Oct 18 ->" : "Hyderabad ->"}</strong><span>{isArtist ? "166 fans committed" : "2,418 potential fans"}</span></div>
          <div className="auth-word">{isArtist ? <>BACK<br /><em>STAGE</em></> : <>SHOW<br /><em>UP</em></>}</div>
        </div>
        <div className="auth-visual-bottom">
          <div><span>{isArtist ? "Artist portal" : "MakeMyShow"}</span><strong>{isArtist ? <>Manage the next<br />show clearly.</> : <>Turn interest<br />into a room full.</>}</strong></div>
          <MoveRight size={28} strokeWidth={1.2} />
        </div>
      </section>
    </main>
  );
}
