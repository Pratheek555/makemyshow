import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../_lib/auth-server";
import { readSupabaseError, supabaseRestUrl, supabaseServiceHeaders } from "../../../../_lib/supabase-rest";

const idPattern = /^[a-zA-Z0-9_-]{8,200}$/;

type ArtistProfileRow = { id: string };
type CityRow = { id: string; name: string };

async function readRows<T>(path: string): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), { headers: supabaseServiceHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

async function writeRows<T>(path: string, body: unknown): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), {
    method: "PATCH",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

async function getOrCreateCity(cityName: string) {
  const cities = await readRows<CityRow>(`/cities?name=eq.${encodeURIComponent(cityName)}&select=id,name&limit=1`);
  if (cities[0]?.id) return cities[0].id;

  const response = await fetch(supabaseRestUrl("/cities"), {
    method: "POST",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ name: cityName, country_code: "IN", is_active: true }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  const created = (await response.json()) as CityRow[];
  if (!created[0]?.id) throw new Error("City was not returned after insert.");
  return created[0].id;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Log in as an artist first." }, { status: 401 });

    const { id } = await params;
    if (!idPattern.test(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { title?: string; city?: string; venue?: string; showType?: string; ticketTier?: string } | null;
    const title = body?.title?.trim();
    const city = body?.city?.trim();
    const venue = body?.venue?.trim();
    const showType = body?.showType === "Demand test" || body?.showType === "Private" ? body.showType : "Ticketed";
    const ticketTier = body?.ticketTier === "Early" || body?.ticketTier === "VIP" ? body.ticketTier : "Standard";
    if (!title || !city || !venue) return NextResponse.json({ error: "Add an event title, city, and venue." }, { status: 400 });

    const artists = await readRows<ArtistProfileRow>(`/artist_profiles?owner_user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    const artistId = artists[0]?.id;
    if (!artistId) return NextResponse.json({ error: "Artist profile was not found." }, { status: 404 });

    const existing = await readRows<{ id: string }>(`/city_drops?id=eq.${encodeURIComponent(id)}&artist_id=eq.${encodeURIComponent(artistId)}&select=id&limit=1`);
    if (!existing[0]) return NextResponse.json({ error: "This event is not owned by your artist profile." }, { status: 403 });

    const cityId = await getOrCreateCity(city);
    const description = [`Venue: ${venue}`, `Show type: ${showType}`, `Ticket tier: ${ticketTier}`, "Submitted from artist dashboard MVP."].join("\n");
    await writeRows(`/city_drops?id=eq.${encodeURIComponent(id)}&artist_id=eq.${encodeURIComponent(artistId)}`, {
      title,
      city_id: cityId,
      description,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update artist event." }, { status: 500 });
  }
}
