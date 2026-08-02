import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseRestUrl, supabaseServiceHeaders } from "../../../_lib/supabase-rest";

type ArtistProfileRow = { id: string };
type CityRow = { id: string; name: string };
type CityDropRow = {
  id: string;
  title: string;
  status: string;
  target_capacity: number;
  venue_capacity: number | null;
  description: string | null;
  created_at: string;
  cities?: { name?: string } | null;
};
type FanMandateDemandRow = {
  city_drop_id: string | null;
  quantity: number;
};

async function readServiceRows<T>(path: string): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), {
    headers: supabaseServiceHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

async function writeServiceRow<T>(path: string, body: unknown, prefer = "return=representation"): Promise<T | null> {
  const response = await fetch(supabaseRestUrl(path), {
    method: "POST",
    headers: {
      ...supabaseServiceHeaders(),
      Prefer: prefer,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  if (response.status === 204 || prefer.includes("return=minimal")) return null;
  return (await response.json()) as T;
}

async function getArtistId(userId: string) {
  const artists = await readServiceRows<ArtistProfileRow>(`/artist_profiles?owner_user_id=eq.${userId}&select=id&limit=1`);
  return artists[0]?.id ?? null;
}

async function getOrCreateCity(cityName: string) {
  const encodedCity = encodeURIComponent(cityName);
  const cities = await readServiceRows<CityRow>(`/cities?name=eq.${encodedCity}&select=id,name&limit=1`);
  if (cities[0]?.id) return cities[0].id;

  const createdCities = await writeServiceRow<CityRow[]>("/cities", {
    name: cityName,
    country_code: "IN",
    is_active: true,
  });
  const cityId = createdCities?.[0]?.id;
  if (!cityId) throw new Error("City was not returned after insert.");
  return cityId;
}

function parseVenue(description: string | null) {
  if (!description) return "Venue support requested";
  const match = description.match(/Venue: ([^\n]+)/);
  return match?.[1] ?? "Venue support requested";
}

function parseDescriptionField(description: string | null, field: string, fallback: string) {
  const match = description?.match(new RegExp(`^${field}: ([^\\n]+)$`, "mi"));
  return match?.[1] ?? fallback;
}

function toDashboardEvent(row: CityDropRow, demand = { mandates: 0, ticketsRequested: 0 }) {
  return {
    id: row.id,
    title: row.title,
    city: row.cities?.name ?? "City TBD",
    date: new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    venue: parseVenue(row.description),
    status: row.status === "live" ? "Live" : row.status === "fulfilled" ? "Completed" : row.status === "draft" ? "Draft" : "Submitted",
    showType: parseDescriptionField(row.description, "Show type", "Ticketed"),
    ticketTier: parseDescriptionField(row.description, "Ticket tier", "Standard"),
    mandates: demand.mandates,
    ticketsRequested: demand.ticketsRequested,
    capacity: row.venue_capacity ?? row.target_capacity ?? 250,
    revenue: "Pending",
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Log in as an artist first." }, { status: 401 });

    const artistId = await getArtistId(user.id);
    if (!artistId) return NextResponse.json({ events: [] });

    const rows = await readServiceRows<CityDropRow>(
      `/city_drops?artist_id=eq.${artistId}&select=id,title,status,target_capacity,venue_capacity,description,created_at,cities(name)&order=created_at.desc`,
    );
    const demandByEvent = new Map<string, { mandates: number; ticketsRequested: number }>();
    if (rows.length > 0) {
      const eventIds = rows.map((row) => encodeURIComponent(row.id)).join(",");
      const mandateRows = await readServiceRows<FanMandateDemandRow>(
        `/fan_mandates?city_drop_id=in.(${eventIds})&status=in.(authorized,artist_approved,charged)&select=city_drop_id,quantity`,
      );
      for (const mandate of mandateRows) {
        if (!mandate.city_drop_id) continue;
        const current = demandByEvent.get(mandate.city_drop_id) ?? { mandates: 0, ticketsRequested: 0 };
        demandByEvent.set(mandate.city_drop_id, {
          mandates: current.mandates + 1,
          ticketsRequested: current.ticketsRequested + Math.max(0, mandate.quantity),
        });
      }
    }

    return NextResponse.json({ events: rows.map((row) => toDashboardEvent(row, demandByEvent.get(row.id))) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load artist events." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Log in as an artist first." }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { title?: string; city?: string; venue?: string; showType?: string; ticketTier?: string } | null;
    const title = body?.title?.trim();
    const city = body?.city?.trim();
    const venue = body?.venue?.trim();
    const showType = body?.showType === "Demand test" || body?.showType === "Private" ? body.showType : "Ticketed";
    const ticketTier = body?.ticketTier === "Early" || body?.ticketTier === "VIP" ? body.ticketTier : "Standard";

    if (!title || !city || !venue) {
      return NextResponse.json({ error: "Add an event title, city, and venue." }, { status: 400 });
    }

    const artistId = await getArtistId(user.id);
    if (!artistId) return NextResponse.json({ error: "Artist profile is still being created. Try again after signup completes." }, { status: 404 });

    const cityId = await getOrCreateCity(city);
    const description = [`Venue: ${venue}`, `Show type: ${showType}`, `Ticket tier: ${ticketTier}`, "Submitted from artist dashboard MVP."].join("\n");
    const rows = await writeServiceRow<CityDropRow[]>("/city_drops", {
      artist_id: artistId,
      city_id: cityId,
      title,
      description,
      status: "artist_review",
      target_commitments: 50,
      target_capacity: 250,
      min_ticket_price_minor: 99900,
      max_ticket_price_minor: 249900,
      currency: "INR",
      venue_capacity: 250,
    });

    const event = rows?.[0] ? toDashboardEvent({ ...rows[0], cities: { name: city } }) : null;
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create artist event." }, { status: 500 });
  }
}
