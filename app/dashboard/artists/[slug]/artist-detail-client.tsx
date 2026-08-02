"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Compass, HeartPulse, MapPin, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import PravaCardForm from "../../../_components/PravaCardForm";
import { cities, money, type ArtistDrop } from "../../data";

type PaymentState = "idle" | "loading" | "collecting" | "recording" | "error" | "complete";

type PravaSession = {
  sessionId: string;
  sessionToken: string;
  iframeUrl: string;
  orderId?: string;
  expiresAt?: string;
  createdAt?: number;
};

type PendingMandate = {
  session: PravaSession;
  city: string;
  quantity: number;
  priceCeiling: number;
  depositCap: number;
  createdAt: number;
};

export default function ArtistDetailClient({ artist }: { artist: ArtistDrop }) {
  const pendingMandateKey = `mms.pending-mandate.${artist.slug}`;
  const recordMandatePromiseRef = useRef<Promise<boolean> | null>(null);
  const [city, setCity] = useState(artist.city ?? "Vijayawada");
  const [quantity, setQuantity] = useState(2);
  const [priceCeiling, setPriceCeiling] = useState(1999);
  const [email, setEmail] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [paymentError, setPaymentError] = useState("");
  const [pravaSession, setPravaSession] = useState<PravaSession | null>(null);
  const [mandateId, setMandateId] = useState<number | null>(null);
  const deposit = useMemo(() => Math.round(priceCeiling * quantity * 0.3), [priceCeiling, quantity]);
  const readiness = Math.min(100, Math.round((artist.demand / artist.target) * 100));

  useEffect(() => {
    const rawPending = window.localStorage.getItem(pendingMandateKey);
    if (!rawPending || paymentState !== "idle") return;

    try {
      const pending = JSON.parse(rawPending) as PendingMandate;
      if (!pending.session?.sessionId || Date.now() - pending.createdAt > 24 * 60 * 60 * 1000) {
        window.localStorage.removeItem(pendingMandateKey);
        return;
      }
      window.setTimeout(() => {
        setCity(pending.city);
        setQuantity(pending.quantity);
        setPriceCeiling(pending.priceCeiling);
        setPravaSession({ ...pending.session, createdAt: pending.session.createdAt ?? pending.createdAt });
        setPaymentState("collecting");
      }, 0);
    } catch {
      window.localStorage.removeItem(pendingMandateKey);
    }
  }, [pendingMandateKey, paymentState]);

  const recordCompletedMandate = useCallback(async (session: PravaSession) => {
    if (recordMandatePromiseRef.current) return recordMandatePromiseRef.current;

    const promise = (async () => {
      setPaymentState("recording");
      const response = await fetch("/api/fan/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionCreatedAt: session.createdAt,
          orderId: session.orderId,
          artistSlug: artist.slug,
          artistName: artist.name,
          city,
          quantity,
          priceCeiling,
          depositCap: deposit,
        }),
      });
      const data = (await response.json()) as { mandateId?: number | null; error?: string };
      if (response.status === 409) {
        setPaymentState("collecting");
        return false;
      }
      if (!response.ok) throw new Error(data.error || "The mandate completed, but we could not store it yet.");
      setMandateId(data.mandateId ?? null);
      setPaymentError("");
      setPravaSession(null);
      setPaymentState("complete");
      window.localStorage.removeItem(pendingMandateKey);
      return true;
    })();

    recordMandatePromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      recordMandatePromiseRef.current = null;
    }
  }, [artist.name, artist.slug, city, deposit, pendingMandateKey, priceCeiling, quantity]);

  useEffect(() => {
    if (paymentState !== "collecting" || !pravaSession) return;

    let active = true;
    let attempts = 0;
    const activeSession = pravaSession;
    const sessionId = activeSession.sessionId;

    async function pollResult() {
      attempts += 1;

      try {
        const response = await fetch(`/api/prava/payment-result?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { status?: string; error?: string | null };

        if (!active) return;

        if (!response.ok) throw new Error(data.error || "We could not confirm the Prava authorization yet.");

        if (data.status === "failed") {
          throw new Error(data.error || "Prava could not complete this authorization.");
        }

        if (data.status === "completed") {
          await recordCompletedMandate(activeSession);
          return;
        }

        if (attempts >= 60) {
          throw new Error("Prava is still processing this authorization. Please refresh in a minute to confirm.");
        }
      } catch (error) {
        if (!active) return;
        setPaymentState("error");
        setPaymentError(error instanceof Error ? error.message : "We could not confirm the Prava authorization.");
      }
    }

    void pollResult();
    const interval = window.setInterval(pollResult, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [paymentState, pravaSession, recordCompletedMandate]);

  async function startMandate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setPaymentState("error");
      setPaymentError("Add a valid email so we can attach this Prava cap to your city drop.");
      return;
    }

    setPaymentState("loading");
    setPaymentError("");
    setPravaSession(null);

    try {
      const response = await fetch("/api/prava/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist: artist.name, city, quantity, priceCeiling, depositCap: deposit, email: normalizedEmail }),
      });
      const data = (await response.json()) as Partial<PravaSession> & { error?: string };

      if (!response.ok || !data.sessionId || !data.sessionToken || !data.iframeUrl) {
        throw new Error(data.error || "We could not start the secure authorization.");
      }

      const sessionCreatedAt = Date.now();
      setPravaSession({
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        iframeUrl: data.iframeUrl,
        orderId: data.orderId,
        expiresAt: data.expiresAt,
        createdAt: sessionCreatedAt,
      });
      window.localStorage.setItem(
        pendingMandateKey,
        JSON.stringify({
          session: {
            sessionId: data.sessionId,
            sessionToken: data.sessionToken,
            iframeUrl: data.iframeUrl,
            orderId: data.orderId,
            expiresAt: data.expiresAt,
            createdAt: sessionCreatedAt,
          },
          city,
          quantity,
          priceCeiling,
          depositCap: deposit,
          createdAt: Date.now(),
        } satisfies PendingMandate),
      );
      setPaymentState("collecting");
    } catch (error) {
      setPaymentState("error");
      setPaymentError(error instanceof Error ? error.message : "We could not start the secure authorization.");
    }
  }

  function cancelPravaCollection() {
    setPaymentState("idle");
    setPaymentError("");
    setPravaSession(null);
    window.localStorage.removeItem(pendingMandateKey);
  }

  return (
    <main className="discover-shell drop-detail-shell">
      <header className="discover-topbar">
        <Link className="discover-brand" href="/" aria-label="MakeMyShow home"><Sparkles aria-hidden="true" size={17} /><span>MakeMyShow</span></Link>
        <nav aria-label="Primary navigation"><Link href="/dashboard"><Compass aria-hidden="true" size={15} /> Discover</Link><span className="active"><CalendarDays aria-hidden="true" size={15} /> City drop</span><span><HeartPulse aria-hidden="true" size={15} /> My mandates</span></nav>
        <div className="discover-topbar-actions"><span className="pulse-label"><span /> Live pulse</span><span className="discover-avatar" aria-label="Your account">PK</span></div>
      </header>

      <div className="drop-detail-content">
        <Link className="drop-back-link" href="/dashboard"><ArrowLeft aria-hidden="true" size={15} /> Back to discovery</Link>

        <section className="drop-hero">
          <img src={artist.image} alt="Live concert performance" />
          <div>
            <span>Live city drop</span>
            <h1>{artist.name}</h1>
            <p>{artist.genre} <i /> {artist.date} <i /> {artist.venue}</p>
            <p className="drop-hero-copy">{artist.description}</p>
          </div>
        </section>

        <div className="drop-detail-layout">
          <section className="drop-event-details">
            <h2>About this drop</h2>
            <div className="drop-detail-facts">
              <article><CalendarDays aria-hidden="true" size={18} /><div><span>Expected window</span><b>{artist.date}</b></div></article>
              <article><MapPin aria-hidden="true" size={18} /><div><span>Best room</span><b>{artist.venue}</b></div></article>
              <article><Users aria-hidden="true" size={18} /><div><span>Local demand</span><b>{artist.demand} of {artist.target} fans</b></div></article>
            </div>
            <div className="drop-readiness"><div><span>{artist.note}</span><b>{readiness}% of local target</b></div><i><em style={{ width: `${readiness}%` }} /></i><p>These are capped fan commitments, not ticket sales. The artist still chooses whether to activate the show.</p></div>
            <div className="drop-steps"><h2>What happens after you commit</h2><p><b>1</b> Your cap becomes part of the local signal.</p><p><b>2</b> The artist sees the city, room fit, and demand.</p><p><b>3</b> Prava only allows a one-time charge after artist acceptance.</p></div>
          </section>

          <aside className="prava-card">
            {paymentState === "complete" ? (
              <div className="prava-complete"><CheckCircle2 aria-hidden="true" size={27} /><strong>Your cap is recorded.</strong><p>Nothing can charge until {artist.name} accepts the {city} city drop.{mandateId ? ` Mandate #${mandateId} is ready for artist approval.` : ""}</p><Link href="/dashboard">Return to discovery</Link></div>
            ) : (
              <form onSubmit={startMandate} noValidate>
                <div className="prava-card-heading"><span><ShieldCheck aria-hidden="true" size={15} /> Secured by Prava</span><b>Authorize, don&apos;t pay</b></div>
                <h2>Back this drop</h2>
                {(paymentState === "collecting" || paymentState === "recording") && pravaSession ? (
                  <>
                    <p>Secure Prava checkout is open. Finish authorization in the payment window.</p>
                    <div className="drop-cap"><span>One-time authorization cap</span><strong>{money(deposit)}</strong><p>30% of {quantity} ticket{quantity > 1 ? "s" : ""} at up to {money(priceCeiling)}. No charge today.</p></div>
                    <p className="drop-payment-progress">{paymentState === "recording" ? "Saving your completed mandate for artist approval." : "Waiting for Prava to confirm the authorization result."}</p>
                    <button className="drop-prava-secondary" type="button" onClick={cancelPravaCollection} disabled={paymentState === "recording"}>Cancel authorization</button>
                  </>
                ) : (
                  <>
                    <p>Set the ticket terms you would be comfortable with if {artist.name} accepts {city}.</p>
                    <label htmlFor="drop-city">Your city</label>
                    <select id="drop-city" value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select>
                    <label>Tickets</label>
                    <div className="drop-choice-grid drop-ticket-grid">{[1, 2, 3, 4].map((count) => <button type="button" className={quantity === count ? "selected" : ""} key={count} onClick={() => setQuantity(count)}>{count}</button>)}</div>
                    <label>Maximum ticket price</label>
                    <div className="drop-choice-grid drop-price-grid">{[1499, 1999, 2499].map((amount) => <button type="button" className={priceCeiling === amount ? "selected" : ""} key={amount} onClick={() => setPriceCeiling(amount)}>{money(amount)}</button>)}</div>
                    <label htmlFor="drop-email">Email for campaign updates</label>
                    <input id="drop-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
                    <div className="drop-cap"><span>One-time authorization cap</span><strong>{money(deposit)}</strong><p>30% of {quantity} ticket{quantity > 1 ? "s" : ""} at up to {money(priceCeiling)}. No charge today.</p></div>
                    <button className="drop-prava-submit" disabled={paymentState === "loading" || paymentState === "recording"}>{paymentState === "loading" ? "Creating secure Prava session..." : paymentState === "recording" ? "Recording mandate..." : "Set up cap with Prava"}<span aria-hidden="true">-&gt;</span></button>
                  </>
                )}
                {paymentState === "error" && <p className="drop-payment-error" role="alert">{paymentError}</p>}
                <p className="drop-prava-note">You can revise or cancel before artist acceptance. The artist decides whether the benefit becomes a reservation or priority access.</p>
              </form>
            )}
          </aside>
        </div>
      </div>

      {(paymentState === "collecting" || paymentState === "recording") && pravaSession && (
        <div className="prava-modal-backdrop" role="presentation">
          <section className="prava-modal prava-modal-plain" role="dialog" aria-modal="true" aria-label="Prava secure checkout">
            {paymentState === "recording" ? (
              <div className="prava-save-state" role="status" aria-live="polite">
                <span className="prava-save-spinner" aria-hidden="true" />
                <strong>Saving your mandate</strong>
                <p>Prava has confirmed the authorization. We&apos;re securely saving it for artist approval.</p>
              </div>
            ) : (
              <>
                <button className="prava-modal-close" type="button" onClick={cancelPravaCollection} aria-label="Close Prava checkout">
                  <X aria-hidden="true" size={20} />
                </button>
                <PravaCardForm
                  session={pravaSession}
                  onSuccess={() => {
                    // Prava's SDK success callback confirms card collection,
                    // not the final mandate authorization.
                    setPaymentState("collecting");
                  }}
                  onSessionComplete={() => {
                    void recordCompletedMandate(pravaSession).catch((error) => {
                      setPaymentState("error");
                      setPaymentError(error instanceof Error ? error.message : "We could not save the Prava mandate.");
                    });
                  }}
                  onError={(error) => {
                    setPaymentState("error");
                    setPaymentError(error.message);
                  }}
                />
              </>
            )}
          </section>
        </div>
      )}

      {paymentState === "complete" && (
        <div className="prava-modal-backdrop" role="presentation">
          <section className="prava-success-modal" role="dialog" aria-modal="true" aria-labelledby="prava-success-title">
            <div className="prava-success-icon"><CheckCircle2 aria-hidden="true" size={28} /></div>
            <span className="prava-success-eyebrow">Mandate saved</span>
            <h2 id="prava-success-title">Your cap is ready.</h2>
            <p>Nothing can charge until {artist.name} accepts the {city} city drop.</p>
            <Link href="/dashboard">Return to discovery</Link>
          </section>
        </div>
      )}
    </main>
  );
}
