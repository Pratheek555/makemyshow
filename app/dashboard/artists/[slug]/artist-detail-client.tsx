"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, Compass, HeartPulse, MapPin, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import PravaCardForm from "../../../_components/PravaCardForm";
import { cities, money, type ArtistDrop } from "../../data";

type PaymentState = "idle" | "loading" | "collecting" | "error" | "complete";

type PravaSession = {
  sessionId: string;
  sessionToken: string;
  iframeUrl: string;
  orderId?: string;
  expiresAt?: string;
};

export default function ArtistDetailClient({ artist }: { artist: ArtistDrop }) {
  const [city, setCity] = useState("Vijayawada");
  const [quantity, setQuantity] = useState(2);
  const [priceCeiling, setPriceCeiling] = useState(1999);
  const [email, setEmail] = useState("");
  const [paymentState, setPaymentState] = useState<PaymentState>(
    () => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("prava") === "complete" ? "complete" : "idle"),
  );
  const [paymentError, setPaymentError] = useState("");
  const [pravaSession, setPravaSession] = useState<PravaSession | null>(null);
  const deposit = useMemo(() => Math.round(priceCeiling * quantity * 0.3), [priceCeiling, quantity]);
  const readiness = Math.min(100, Math.round((artist.demand / artist.target) * 100));

  useEffect(() => {
    if (paymentState !== "collecting" || !pravaSession) return;

    let active = true;
    let attempts = 0;
    const sessionId = pravaSession.sessionId;

    async function pollResult() {
      attempts += 1;

      try {
        const response = await fetch(`/api/prava/payment-result?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { status?: string; error?: string | null };

        if (!active) return;

        if (!response.ok) throw new Error(data.error || "We could not confirm the Prava authorization yet.");

        if (data.status === "completed") {
          setPaymentState("complete");
          setPaymentError("");
          return;
        }

        if (data.status === "failed") {
          throw new Error(data.error || "Prava could not complete this authorization.");
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
  }, [paymentState, pravaSession]);

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

      setPravaSession({
        sessionId: data.sessionId,
        sessionToken: data.sessionToken,
        iframeUrl: data.iframeUrl,
        orderId: data.orderId,
        expiresAt: data.expiresAt,
      });
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
              <div className="prava-complete"><CheckCircle2 aria-hidden="true" size={27} /><strong>Your cap is recorded.</strong><p>Nothing can charge until {artist.name} accepts the {city} city drop.</p><Link href="/dashboard">Return to discovery</Link></div>
            ) : (
              <form onSubmit={startMandate} noValidate>
                <div className="prava-card-heading"><span><ShieldCheck aria-hidden="true" size={15} /> Secured by Prava</span><b>Authorize, don&apos;t pay</b></div>
                <h2>Back this drop</h2>
                {paymentState === "collecting" && pravaSession ? (
                  <>
                    <p>Secure Prava checkout is open. Finish authorization in the payment window.</p>
                    <div className="drop-cap"><span>One-time authorization cap</span><strong>{money(deposit)}</strong><p>30% of {quantity} ticket{quantity > 1 ? "s" : ""} at up to {money(priceCeiling)}. No charge today.</p></div>
                    <p className="drop-payment-progress">Waiting for Prava to confirm the authorization result.</p>
                    <button className="drop-prava-secondary" type="button" onClick={cancelPravaCollection}>Cancel authorization</button>
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
                    <button className="drop-prava-submit" disabled={paymentState === "loading"}>{paymentState === "loading" ? "Creating secure Prava session..." : "Set up cap with Prava"}<span aria-hidden="true">-&gt;</span></button>
                  </>
                )}
                {paymentState === "error" && <p className="drop-payment-error" role="alert">{paymentError}</p>}
                <p className="drop-prava-note">You can revise or cancel before artist acceptance. The artist decides whether the benefit becomes a reservation or priority access.</p>
              </form>
            )}
          </aside>
        </div>
      </div>

      {paymentState === "collecting" && pravaSession && (
        <div className="prava-modal-backdrop" role="presentation">
          <section className="prava-modal prava-modal-plain" role="dialog" aria-modal="true" aria-label="Prava secure checkout">
            <button className="prava-modal-close" type="button" onClick={cancelPravaCollection} aria-label="Close Prava checkout">
              <X aria-hidden="true" size={20} />
            </button>
            <PravaCardForm
              session={pravaSession}
              onError={(error) => {
                setPaymentState("error");
                setPaymentError(error.message);
              }}
            />
          </section>
        </div>
      )}
    </main>
  );
}
