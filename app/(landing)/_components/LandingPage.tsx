"use client";

/* eslint-disable @next/next/no-img-element */

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { audienceSegments, citySignals, storySteps } from "../_data/story";

export default function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const shellRef = useRef<HTMLElement | null>(null);
  const [activeSegment, setActiveSegment] = useState(audienceSegments[0].label);
  const [sessionIsActive, setSessionIsActive] = useState(isLoggedIn);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { user?: unknown };
        if (mounted) setSessionIsActive(response.ok && Boolean(data.user));
      })
      .catch(() => {
        if (mounted) setSessionIsActive(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSegment = useMemo(
    () => audienceSegments.find((segment) => segment.label === activeSegment) ?? audienceSegments[0],
    [activeSegment],
  );

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealItems = Array.from(shell.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reducedMotion) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return;
    }

    let frame = 0;
    const updateScrollProgress = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      shell.style.setProperty("--scroll-progress", progress.toFixed(4));
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollProgress);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.16 },
    );

    revealItems.forEach((item) => observer.observe(item));
    updateScrollProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main id="top" className="landing-shell" ref={shellRef}>
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="MakeMyShow home">
          <span>M</span>
          <b>MakeMyShow</b>
        </a>
        <nav aria-label="Landing navigation">
          <a href="#story">Story</a>
          <a href="#audience">Audience map</a>
          {sessionIsActive && <a href="/dashboard">Dashboard</a>}
        </nav>
        {sessionIsActive ? (
          <a className="landing-nav-cta" href="/dashboard">Open dashboard</a>
        ) : (
          <div className="landing-auth-links">
            <a href="/login">Log in</a>
            <a className="landing-nav-cta" href="/signup">Sign up</a>
          </div>
        )}
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy" data-reveal>
          <p className="landing-kicker">Demand-backed live shows</p>
          <h1>Every artist has fans somewhere. We show them where.</h1>
          <p>
            MakeMyShow turns scattered fan enthusiasm into money-backed audience signals, so artists
            can reach the cities, rooms, and communities that are actually ready for them.
          </p>
          <div className="landing-actions">
            <a className="landing-primary" href={sessionIsActive ? "/dashboard" : "/login"}>Explore live demand <span aria-hidden="true">-&gt;</span></a>
            <a className="landing-secondary" href="#story">Read the story</a>
          </div>
        </div>

        <div className="landing-stage" aria-label="Artist audience demand map" data-reveal>
          <img
            src="https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85"
            alt="A musician performing to a packed concert audience"
          />
          <div className="stage-signal-card card-a">
            <span>Ready audience</span>
            <strong>Vijayawada</strong>
            <small>166 fans committed</small>
          </div>
          <div className="stage-signal-card card-b">
            <span>Best fit</span>
            <strong>220 cap room</strong>
            <small>High intent, lower risk</small>
          </div>
        </div>
      </section>

      <section id="story" className="problem-band" data-reveal>
        <div>
          <p className="landing-kicker">The problem</p>
          <h2>Artists are surrounded by signals. Most of them are too soft to route a show.</h2>
        </div>
        <p>
          A thousand comments can still leave an artist guessing. Which city has people who will
          turn up? What price is realistic? Is the room too big, too small, or just right? We replace
          that guesswork with committed audience demand.
        </p>
      </section>

      <section className="story-grid" aria-label="MakeMyShow product story">
        {storySteps.map((step, index) => (
          <article key={step.title} data-reveal style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
          </article>
        ))}
      </section>

      <section id="audience" className="audience-band">
        <div className="audience-copy" data-reveal>
          <p className="landing-kicker">Right audience, right city</p>
          <h2>We do not just count fans. We find the crowd that makes the show make sense.</h2>
          <p>
            The artist sees where the audience is concentrated, how much they are willing to pay,
            and what type of experience can work before committing to a date.
          </p>
          <div className="segment-tabs" role="group" aria-label="Audience segment">
            {audienceSegments.map((segment) => (
              <button
                className={activeSegment === segment.label ? "selected" : ""}
                key={segment.label}
                onClick={() => setActiveSegment(segment.label)}
              >
                {segment.label}
              </button>
            ))}
          </div>
        </div>

        <div className="audience-panel" data-reveal>
          <div className="audience-panel-head">
            <span>Audience match</span>
            <strong>{selectedSegment.city}</strong>
          </div>
          <p>{selectedSegment.proof}</p>
          <div className="city-signal-list">
            {citySignals.map((signal) => (
              <article key={signal.city}>
                <div>
                  <b>{signal.city}</b>
                  <span>{signal.fit}</span>
                </div>
                <strong>{signal.fans}</strong>
                <i aria-label={`${signal.strength}% signal strength`}>
                  <em style={{ width: `${signal.strength}%` }} />
                </i>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="proof-band">
        <div className="proof-copy" data-reveal>
          <p className="landing-kicker">Why artists say yes</p>
          <h2>Before the show exists, the audience has already raised its hand.</h2>
        </div>
        <div className="proof-metrics">
          <article data-reveal style={{ "--reveal-delay": "80ms" } as CSSProperties}>
            <span>1,147</span>
            <p>fans with a live commitment across current city drops</p>
          </article>
          <article data-reveal style={{ "--reveal-delay": "160ms" } as CSSProperties}>
            <span>12</span>
            <p>cities compared by real demand instead of market reputation</p>
          </article>
          <article data-reveal style={{ "--reveal-delay": "240ms" } as CSSProperties}>
            <span>30%</span>
            <p>authorization cap that proves intent without charging fans upfront</p>
          </article>
        </div>
      </section>

      <section className="closing-band" data-reveal>
        <p className="landing-kicker">Make the next show obvious</p>
        <h2>Stop asking where the audience might be. Let the right audience reveal itself.</h2>
        <a className="landing-primary dark" href={sessionIsActive ? "/dashboard" : "/login"}>{sessionIsActive ? "See the dashboard" : "Log in to explore"} <span aria-hidden="true">-&gt;</span></a>
      </section>
    </main>
  );
}
