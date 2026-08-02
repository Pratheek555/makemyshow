"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { CalendarDays, Compass, Disc3, Headphones, HeartPulse, LogOut, MapPin, MicVocal, Music2, PartyPopper, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cities, type ArtistDrop } from "./data";

type DiscoveryCategory = {
  name: string;
  description: string;
  icon: LucideIcon;
  matches: (artist: ArtistDrop) => boolean;
};

type SessionUser = {
  email?: string;
  user_metadata?: { display_name?: string };
};

type LiveDropsResponse = {
  drops?: ArtistDrop[];
  error?: string;
};

type FanMandate = {
  id: number;
  artist_name: string;
  city: string;
  quantity: number;
  price_ceiling_minor: number;
  deposit_cap_minor: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type MandatesResponse = {
  mandates?: FanMandate[];
  error?: string;
};

function getInitials(user: SessionUser) {
  const label = user.user_metadata?.display_name?.trim() || user.email?.split("@")[0] || "You";
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

const categoryIcons: Record<string, LucideIcon> = {
  "All artists": Sparkles,
  Electronic: Disc3,
  "Hip-hop": MicVocal,
  "Indie folk": Music2,
  "Indie pop": Headphones,
  "Popular now": PartyPopper,
};

function countLabel(count: number, singular = "city drop") {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatMandateAmount(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

function formatMandateDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function mandateStatusLabel(status: string) {
  return {
    authorized: "Authorized",
    artist_approved: "Artist approved",
    charged: "Charged",
    cancelled: "Cancelled",
    failed: "Failed",
  }[status] ?? status.replaceAll("_", " ");
}

export default function DashboardPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [accountInitials, setAccountInitials] = useState("ME");
  const [city, setCity] = useState("Vijayawada");
  const [activeCategory, setActiveCategory] = useState("All artists");
  const [drops, setDrops] = useState<ArtistDrop[]>([]);
  const [loadingDrops, setLoadingDrops] = useState(true);
  const [dropsError, setDropsError] = useState("");
  const [mandates, setMandates] = useState<FanMandate[]>([]);
  const [loadingMandates, setLoadingMandates] = useState(true);
  const [mandatesError, setMandatesError] = useState("");
  const discoveryCategories = useMemo<DiscoveryCategory[]>(() => {
    const genres = Array.from(new Set(drops.map((artist) => artist.genre).filter(Boolean))).sort();
    const categories: DiscoveryCategory[] = [
      { name: "All artists", description: countLabel(drops.length), icon: Sparkles, matches: () => true },
      ...genres.map((genre) => ({
        name: genre,
        description: countLabel(drops.filter((artist) => artist.genre === genre).length),
        icon: categoryIcons[genre] ?? Music2,
        matches: (artist: ArtistDrop) => artist.genre === genre,
      })),
      {
        name: "Popular now",
        description: countLabel(drops.filter((artist) => artist.demand >= Math.max(1, Math.round(artist.target * 0.5))).length, "rising signal"),
        icon: PartyPopper,
        matches: (artist) => artist.demand >= Math.max(1, Math.round(artist.target * 0.5)),
      },
    ];
    return categories;
  }, [drops]);
  const activeCategoryData = discoveryCategories.find((category) => category.name === activeCategory) ?? discoveryCategories[0];
  const filteredArtists = useMemo(() => drops.filter(activeCategoryData.matches), [activeCategoryData, drops]);

  const loadLiveDrops = useCallback(async () => {
    setLoadingDrops(true);
    setDropsError("");

    try {
      const response = await fetch("/api/fan/drops", { cache: "no-store" });
      const data = (await response.json()) as LiveDropsResponse;
      if (!response.ok) throw new Error(data.error || "Could not load live city drops.");
      setDrops(data.drops ?? []);
    } catch (error) {
      setDrops([]);
      setDropsError(error instanceof Error ? error.message : "Could not load live city drops.");
    } finally {
      setLoadingDrops(false);
    }
  }, []);

  const loadMandates = useCallback(async () => {
    setLoadingMandates(true);
    setMandatesError("");

    try {
      const response = await fetch("/api/fan/mandates", { cache: "no-store" });
      const data = (await response.json()) as MandatesResponse;
      if (!response.ok) throw new Error(data.error || "Could not load your mandates.");
      setMandates(data.mandates ?? []);
    } catch (error) {
      setMandates([]);
      setMandatesError(error instanceof Error ? error.message : "Could not load your mandates.");
    } finally {
      setLoadingMandates(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { user?: SessionUser };
        if (!response.ok || !data.user) {
          window.location.assign("/login");
          return;
        }
        setAccountInitials(getInitials(data.user));
        setCheckingSession(false);
        void loadLiveDrops();
        void loadMandates();
      })
      .catch(() => window.location.assign("/login"));
  }, [loadLiveDrops, loadMandates]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  if (checkingSession) {
    return (
      <main className="discover-shell route-loading-shell">
        <div className="route-loading-card" role="status" aria-live="polite">
          <Sparkles aria-hidden="true" size={22} />
          <strong>Opening your dashboard</strong>
          <span>Checking your MakeMyShow session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="discover-shell">
      <header className="discover-topbar">
        <Link className="discover-brand" href="/" aria-label="MakeMyShow home"><Sparkles aria-hidden="true" size={17} /><span>MakeMyShow</span></Link>
        <nav aria-label="Primary navigation">
          <a href="#featured"><CalendarDays aria-hidden="true" size={15} /> City drops</a>
          <a href="#mandates"><HeartPulse aria-hidden="true" size={15} /> My mandates</a>
          <a className="active" href="#discover"><Compass aria-hidden="true" size={15} /> Discover</a>
        </nav>
        <div className="discover-topbar-actions">
          <span className="pulse-label"><span /> Live pulse</span>
          <label className="discover-city-select"><MapPin aria-hidden="true" size={14} /><span className="sr-only">Choose your city</span><select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <span className="discover-avatar" aria-label={`Signed in as ${accountInitials}`}>{accountInitials}</span>
          <button className="discover-logout-button" aria-label="Log out" title="Log out" onClick={logout} type="button"><LogOut aria-hidden="true" size={14} /> <span>Log out</span></button>
        </div>
      </header>

      <div id="discover" className="discover-content">
        <section className="discover-intro"><h1>Discover artists</h1><p>Explore demand-backed city drops near you, browse by sound, or find the artist your community is ready to bring home.</p></section>

        <section className="discover-section" aria-labelledby="category-heading">
          <h2 id="category-heading">Browse by sound</h2>
          <div className="sound-category-grid">
            {discoveryCategories.map((category) => {
              const Icon = category.icon;
              return <button className={activeCategory === category.name ? "selected" : ""} key={category.name} onClick={() => setActiveCategory(category.name)}><Icon aria-hidden="true" size={25} /><span><b>{category.name}</b><small>{category.description}</small></span></button>;
            })}
          </div>
        </section>

        <div className="discover-divider" />

        <section id="featured" className="discover-section featured-drops" aria-labelledby="featured-heading">
          <div className="featured-heading"><div><h2 id="featured-heading">Featured city drops</h2><p>{activeCategory === "All artists" ? `Artists collecting real demand in ${city}.` : `${activeCategory} drops collecting real demand in ${city}.`}</p></div><span>{filteredArtists.length} active</span></div>
          {dropsError && <p className="discover-empty discover-error" role="alert">{dropsError}</p>}
          {loadingDrops ? (
            <p className="discover-empty">Loading live city drops...</p>
          ) : (
            <>
              <div className="featured-artist-grid">
                {filteredArtists.map((artist) => (
                  <Link className="featured-artist-card" href={`/dashboard/artists/${artist.slug}`} key={artist.slug}>
                    <div className="artist-card-topline"><img src={artist.image} alt="Live concert performance" /><span>View drop</span></div>
                    <h3>{artist.name}</h3>
                    <p>{artist.genre} city drop in {artist.city ?? city}</p>
                    <div className="artist-card-signal"><span><b>{artist.demand}</b> fans committed</span><em>{artist.note}</em></div>
                  </Link>
                ))}
              </div>
              {filteredArtists.length === 0 && <p className="discover-empty">No live city drops match this sound yet.</p>}
            </>
          )}
        </section>

        <div className="discover-divider" />

        <section id="mandates" className="discover-section mandates-section" aria-labelledby="mandates-heading">
          <div className="featured-heading">
            <div><h2 id="mandates-heading">My mandates</h2><p>Review the commitments you have authorized for upcoming city drops.</p></div>
            <span>{countLabel(mandates.length, "mandate")}</span>
          </div>
          {mandatesError && <p className="discover-empty discover-error" role="alert">{mandatesError}</p>}
          {loadingMandates ? (
            <p className="discover-empty">Loading your mandates...</p>
          ) : mandates.length === 0 ? (
            <div className="mandates-empty">
              <HeartPulse aria-hidden="true" size={22} />
              <div><strong>No mandates yet</strong><p>When you authorize a cap for a city drop, it will appear here for easy checking.</p></div>
              <a href="#featured">Browse city drops <span aria-hidden="true">-&gt;</span></a>
            </div>
          ) : (
            <div className="mandates-grid">
              {mandates.map((mandate) => (
                <article className="mandate-card" key={mandate.id}>
                  <div className="mandate-card-topline"><span>Mandate #{mandate.id}</span><b className={`mandate-status mandate-status-${mandate.status}`}>{mandateStatusLabel(mandate.status)}</b></div>
                  <h3>{mandate.artist_name}</h3>
                  <p className="mandate-card-location">{mandate.city} city drop</p>
                  <div className="mandate-card-facts">
                    <div><span>Cap</span><strong>{formatMandateAmount(mandate.deposit_cap_minor, mandate.currency)}</strong></div>
                    <div><span>Tickets</span><strong>{mandate.quantity}</strong></div>
                    <div><span>Ticket ceiling</span><strong>{formatMandateAmount(mandate.price_ceiling_minor, mandate.currency)}</strong></div>
                    <div><span>Authorized</span><strong>{formatMandateDate(mandate.created_at)}</strong></div>
                  </div>
                  <p className="mandate-card-note">Your cap stays within the selected ticket terms. No charge is made until the artist approves the city drop.</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
