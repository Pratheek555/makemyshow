"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Eye,
  FileText,
  GalleryHorizontalEnd,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquareText,
  MicVocal,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Ticket,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SessionUser = {
  email?: string;
  user_metadata?: {
    display_name?: string;
    artist_profile?: {
      artist_name?: string;
      category?: string;
      base_city?: string;
      verification_status?: string;
      db_persisted?: boolean;
    };
  };
};

type ArtistEvent = {
  id?: string;
  title: string;
  city: string;
  date: string;
  venue: string;
  status: "Live" | "Submitted" | "Draft" | "Completed";
  sold: number;
  capacity: number;
  revenue: string;
};

const checklist = [
  { label: "Profile basics", done: true, icon: BadgeCheck },
  { label: "Social proof", done: true, icon: Megaphone },
  { label: "Press photos", done: true, icon: GalleryHorizontalEnd },
  { label: "Bank details", done: true, icon: Banknote },
  { label: "Government ID", done: false, icon: FileText },
];

const bookingRequests = [
  { from: "Moonlit Rooms", city: "Chennai", date: "25 Nov", budget: "INR 3.5L", status: "New" },
  { from: "Campus Union", city: "Manipal", date: "08 Dec", budget: "INR 2.2L", status: "Negotiating" },
  { from: "North Star Fest", city: "Delhi", date: "18 Jan", budget: "INR 5.8L", status: "Hold" },
];

const notifications = [
  "Vijayawada show crossed 65% demand readiness.",
  "Hyderabad poster update was approved.",
  "Payout for Late Night Circuit is scheduled for 05 Aug.",
  "One booking request needs a response within 24 hours.",
];

const audienceCities = [
  { city: "Hyderabad", fans: 2418, strength: 92 },
  { city: "Vijayawada", fans: 1147, strength: 74 },
  { city: "Bengaluru", fans: 984, strength: 63 },
  { city: "Chennai", fans: 706, strength: 49 },
];

function getInitials(user: SessionUser | null) {
  const label = user?.user_metadata?.display_name?.trim() || user?.email?.split("@")[0] || "Artist";
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function Metric({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <article>
      <div><Icon size={18} /><span>{label}</span></div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function EventRow({ event }: { event: ArtistEvent }) {
  const progress = event.capacity ? Math.round((event.sold / event.capacity) * 100) : 0;
  return (
    <article className="artist-event-row">
      <div className="artist-event-date"><span>{event.date}</span><small>{event.city}</small></div>
      <div className="artist-event-main">
        <div>
          <h3>{event.title}</h3>
          <p><MapPin size={13} /> {event.venue}</p>
        </div>
        <span className={`artist-status artist-status-${event.status.toLowerCase()}`}>{event.status}</span>
      </div>
      <div className="artist-event-progress">
        <div><span>{event.sold} sold</span><b>{event.capacity} cap</b></div>
        <i><em style={{ width: `${Math.min(progress, 100)}%` }} /></i>
      </div>
      <strong>{event.revenue}</strong>
      <div className="artist-row-actions">
        <button type="button" aria-label={`Edit ${event.title}`}><Pencil size={15} /></button>
        <button type="button" aria-label={`View ${event.title}`}><Eye size={15} /></button>
      </div>
    </article>
  );
}

export default function ArtistDashboardPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isMvpSession, setIsMvpSession] = useState(false);
  const [events, setEvents] = useState<ArtistEvent[]>([]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventCity, setEventCity] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [showType, setShowType] = useState("Ticketed");
  const [ticketTier, setTicketTier] = useState("Standard");
  const [eventStatus, setEventStatus] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { user?: SessionUser; mvpSession?: boolean };
        if (!response.ok || !data.user) {
          window.location.assign("/artist/login");
          return;
        }
        setUser(data.user);
        setIsMvpSession(Boolean(data.mvpSession || data.user.user_metadata?.artist_profile?.db_persisted === false));
        setCheckingSession(false);
        void loadEvents();
      })
      .catch(() => window.location.assign("/artist/login"));
  }, []);

  const artistProfile = user?.user_metadata?.artist_profile;
  const artistName = artistProfile?.artist_name || user?.user_metadata?.display_name || "Neon Monsoon";
  const accountInitials = useMemo(() => getInitials(user), [user]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  async function loadEvents() {
    const response = await fetch("/api/artist/events", { cache: "no-store" });
    const data = (await response.json()) as { events?: ArtistEvent[]; error?: string };
    if (!response.ok) {
      setEventStatus(data.error || "Could not load events.");
      return;
    }
    setEvents(data.events ?? []);
  }

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingEvent(true);
    setEventStatus("");

    const response = await fetch("/api/artist/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: eventTitle,
        city: eventCity,
        venue: eventVenue,
        showType,
        ticketTier,
      }),
    });
    const data = (await response.json()) as { event?: ArtistEvent; error?: string };
    setCreatingEvent(false);

    if (!response.ok) {
      setEventStatus(data.error || "Could not create event.");
      return;
    }

    setEventTitle("");
    setEventCity("");
    setEventVenue("");
    setEventStatus("Event submitted and saved to Supabase.");
    if (data.event) setEvents((current) => [data.event as ArtistEvent, ...current]);
    else void loadEvents();
  }

  if (checkingSession) {
    return (
      <main className="artist-portal-shell artist-loading-shell">
        <div className="route-loading-card artist-route-loading-card" role="status" aria-live="polite">
          <MicVocal aria-hidden="true" size={22} />
          <strong>Opening backstage</strong>
          <span>Checking your artist session...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="artist-portal-shell">
      <aside className="artist-portal-sidebar" aria-label="Artist portal navigation">
        <Link className="artist-portal-brand" href="/">
          <span>M</span>
          <b>MakeMyShow</b>
        </Link>
        <nav>
          <a className="active" href="#overview"><LayoutDashboard size={17} /> Overview</a>
          <a href="#shows"><Ticket size={17} /> Shows</a>
          <a href="#profile"><MicVocal size={17} /> Profile</a>
          <a href="#bookings"><MessageSquareText size={17} /> Bookings</a>
          <a href="#payments"><IndianRupee size={17} /> Payments</a>
          <a href="#settings"><Settings size={17} /> Settings</a>
        </nav>
        <button className="artist-logout" type="button" onClick={logout}><LogOut size={16} /> Log out</button>
      </aside>

      <section className="artist-portal-main">
        <header className="artist-portal-topbar">
          <div>
            <span>Artist dashboard</span>
            <h1>{artistName}</h1>
          </div>
          <div className="artist-topbar-actions">
            <button type="button" aria-label="Open notifications"><Bell size={17} /></button>
            <a href="#create-show"><Plus size={16} /> Create event</a>
            <div className="artist-account-chip" aria-label="Artist account">{accountInitials}</div>
          </div>
        </header>

        <section id="overview" className="artist-verification-band">
          <div>
            <p><CircleAlert size={16} /> {isMvpSession ? "MVP local session" : "Account pending review"}</p>
            <h2>{isMvpSession ? "This artist profile is available for the demo, but it has not been saved to Supabase yet." : "Your artist account is kept in review, but you can create event drafts while verification is pending."}</h2>
          </div>
          <button type="button"><Upload size={16} /> {isMvpSession ? "Reconnect Supabase" : "Upload ID"}</button>
        </section>

        <section className="artist-metrics-grid" aria-label="Artist performance summary">
          <Metric icon={CalendarClock} label="Submitted events" value={String(events.length)} note="Saved in Supabase city_drops" />
          <Metric icon={Users} label="Tickets sold" value="0" note="Sales unlock after event approval" />
          <Metric icon={IndianRupee} label="Projected revenue" value="Pending" note="Estimated after pricing review" />
          <Metric icon={ClipboardList} label="Pending actions" value={isMvpSession ? "1" : "2"} note="Verification and event review" />
        </section>

        <div className="artist-workspace-grid">
          <section id="shows" className="artist-panel artist-shows-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Show management</span>
                <h2>Upcoming and recent events</h2>
              </div>
              <button type="button">View all <ChevronRight size={15} /></button>
            </div>
            <div className="artist-events-list">
              {events.map((event) => <EventRow event={event} key={event.id ?? `${event.title}-${event.city}`} />)}
              {events.length === 0 && <p className="artist-empty-state">No DB-backed events yet. Create one from the panel.</p>}
            </div>
          </section>

          <aside id="create-show" className="artist-panel artist-create-panel">
            <div className="artist-panel-heading compact">
              <div>
                <span>New event</span>
                <h2>Create show</h2>
              </div>
              <Sparkles size={18} />
            </div>
            <form className="artist-event-form" onSubmit={createEvent}>
              <label>Event title<input type="text" placeholder="Monsoon Room Sessions" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} required /></label>
              <label>City<input type="text" placeholder="Hyderabad" value={eventCity} onChange={(event) => setEventCity(event.target.value)} required /></label>
              <label>Venue<input type="text" placeholder="Venue or support request" value={eventVenue} onChange={(event) => setEventVenue(event.target.value)} required /></label>
              <div className="artist-segmented" role="group" aria-label="Show type">
                {["Ticketed", "Demand test", "Private"].map((item) => <button className={showType === item ? "selected" : ""} type="button" key={item} onClick={() => setShowType(item)}>{item}</button>)}
              </div>
              <div className="artist-segmented" role="group" aria-label="Ticket tier">
                {["Early", "Standard", "VIP"].map((item) => <button className={ticketTier === item ? "selected" : ""} type="button" key={item} onClick={() => setTicketTier(item)}>{item}</button>)}
              </div>
              <button className="artist-primary-action" type="submit" disabled={creatingEvent}>{creatingEvent ? "Saving..." : "Submit for review"} <ArrowUpRight size={16} /></button>
              {eventStatus && <p className="artist-form-status">{eventStatus}</p>}
            </form>
          </aside>
        </div>

        <div className="artist-secondary-grid">
          <section id="profile" className="artist-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Public profile</span>
                <h2>Profile completion</h2>
              </div>
              <strong className="artist-score">82%</strong>
            </div>
            <div className="artist-checklist">
              {checklist.map((item) => {
                const Icon = item.icon;
                return <p key={item.label} className={item.done ? "done" : ""}><Icon size={16} /> <span>{item.label}</span>{item.done ? <CheckCircle2 size={15} /> : <Plus size={15} />}</p>;
              })}
            </div>
            <button className="artist-secondary-action" type="button">Preview public profile <Eye size={15} /></button>
          </section>

          <section className="artist-panel artist-analytics-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Audience analytics</span>
                <h2>Strongest cities</h2>
              </div>
            </div>
            <div className="artist-city-list">
              {audienceCities.map((city) => (
                <article key={city.city}>
                  <div><b>{city.city}</b><span>{city.fans.toLocaleString("en-IN")} interested fans</span></div>
                  <i><em style={{ width: `${city.strength}%` }} /></i>
                </article>
              ))}
            </div>
          </section>

          <section id="bookings" className="artist-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Bookings</span>
                <h2>Incoming requests</h2>
              </div>
            </div>
            <div className="artist-request-list">
              {bookingRequests.map((request) => (
                <article key={`${request.from}-${request.city}`}>
                  <div><b>{request.from}</b><span>{request.city} * {request.date} * {request.budget}</span></div>
                  <button type="button">{request.status}</button>
                </article>
              ))}
            </div>
          </section>

          <section id="payments" className="artist-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Payments</span>
                <h2>Payouts and invoices</h2>
              </div>
            </div>
            <div className="artist-payment-card">
              <span>Next payout</span>
              <strong>INR 4.8L</strong>
              <p>Scheduled after settlement for Hyderabad, with tax invoice ready for download.</p>
            </div>
            <button className="artist-secondary-action" type="button">Manage bank details <Banknote size={15} /></button>
          </section>

          <section className="artist-panel artist-notifications-panel">
            <div className="artist-panel-heading">
              <div>
                <span>Notifications</span>
                <h2>Needs attention</h2>
              </div>
            </div>
            <div className="artist-notification-list">
              {notifications.map((notification) => <p key={notification}><Bell size={14} /> {notification}</p>)}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
