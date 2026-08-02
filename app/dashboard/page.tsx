"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { CalendarDays, Compass, Disc3, Headphones, HeartPulse, MapPin, MicVocal, Music2, PartyPopper, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { artistDrops, cities, type ArtistDrop } from "./data";

type DiscoveryCategory = {
  name: string;
  description: string;
  icon: LucideIcon;
  matches: (artist: ArtistDrop) => boolean;
};

const discoveryCategories: DiscoveryCategory[] = [
  { name: "All artists", description: "6 city drops", icon: Sparkles, matches: () => true },
  { name: "Indie folk", description: "1 city drop", icon: Music2, matches: (artist) => artist.genre === "Indie folk" },
  { name: "Indie pop", description: "2 city drops", icon: Headphones, matches: (artist) => artist.genre === "Indie pop" },
  { name: "Electronic", description: "1 city drop", icon: Disc3, matches: (artist) => artist.genre === "Electronic" },
  { name: "Hip-hop", description: "2 city drops", icon: MicVocal, matches: (artist) => artist.genre === "Hip-hop" },
  { name: "Popular now", description: "4 rising signals", icon: PartyPopper, matches: (artist) => artist.demand >= 100 },
];

export default function DashboardPage() {
  const [city, setCity] = useState("Vijayawada");
  const [activeCategory, setActiveCategory] = useState("All artists");
  const activeCategoryData = discoveryCategories.find((category) => category.name === activeCategory) ?? discoveryCategories[0];
  const filteredArtists = useMemo(() => artistDrops.filter(activeCategoryData.matches), [activeCategoryData]);

  return (
    <main className="discover-shell">
      <header className="discover-topbar">
        <Link className="discover-brand" href="/" aria-label="MakeMyShow home"><Sparkles aria-hidden="true" size={17} /><span>MakeMyShow</span></Link>
        <nav aria-label="Primary navigation">
          <a href="#featured"><CalendarDays aria-hidden="true" size={15} /> City drops</a>
          <a href="#featured"><HeartPulse aria-hidden="true" size={15} /> My mandates</a>
          <a className="active" href="#discover"><Compass aria-hidden="true" size={15} /> Discover</a>
        </nav>
        <div className="discover-topbar-actions">
          <span className="pulse-label"><span /> Live pulse</span>
          <label className="discover-city-select"><MapPin aria-hidden="true" size={14} /><span className="sr-only">Choose your city</span><select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
          <span className="discover-avatar" aria-label="Your account">PK</span>
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
          <div className="featured-artist-grid">
            {filteredArtists.map((artist) => (
              <Link className="featured-artist-card" href={`/dashboard/artists/${artist.slug}`} key={artist.slug}>
                <div className="artist-card-topline"><img src={artist.image} alt="Live concert performance" /><span>View drop</span></div>
                <h3>{artist.name}</h3>
                <p>{artist.genre} city drop in {city}</p>
                <div className="artist-card-signal"><span><b>{artist.demand}</b> fans committed</span><em>{artist.note}</em></div>
              </Link>
            ))}
          </div>
          {filteredArtists.length === 0 && <p className="discover-empty">No city drops match this sound yet.</p>}
        </section>
      </div>
    </main>
  );
}
