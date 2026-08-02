import { artistDrops, money, type ArtistDrop } from "../dashboard/data";
import { readSupabaseError, supabaseRestUrl, supabaseServiceHeaders } from "./supabase-rest";

const fallbackImages = artistDrops.map((artist) => artist.image);

type CityDropRow = {
  id: string;
  title: string;
  status: string;
  target_commitments: number | null;
  target_capacity: number | null;
  venue_capacity: number | null;
  min_ticket_price_minor: number | null;
  max_ticket_price_minor: number | null;
  currency: string | null;
  description: string | null;
  created_at: string;
  cities?: { name?: string } | null;
  artist_profiles?: {
    stage_name?: string | null;
    genre?: string | null;
    bio?: string | null;
  } | null;
};

async function readServiceRows<T>(path: string): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), {
    headers: supabaseServiceHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

function parseVenue(description: string | null, capacity: number | null) {
  const fallback = capacity ? `${capacity} cap room` : "Venue support requested";
  if (!description) return fallback;
  const match = description.match(/Venue: ([^\n]+)/);
  return match?.[1] ?? fallback;
}

function parseDescription(row: CityDropRow) {
  const bio = row.artist_profiles?.bio?.trim();
  if (bio) return bio;
  if (row.description) {
    const cleaned = row.description
      .split("\n")
      .filter((line) => !/^(Venue|Show type|Ticket tier):/i.test(line))
      .join(" ")
      .trim();
    if (cleaned) return cleaned;
  }
  return "A live city drop collecting real audience demand before the artist commits to a date.";
}

function priceRange(row: CityDropRow) {
  const min = row.min_ticket_price_minor ? Math.round(row.min_ticket_price_minor / 100) : null;
  const max = row.max_ticket_price_minor ? Math.round(row.max_ticket_price_minor / 100) : null;
  if (min && max && min !== max) return `${money(min)}-${money(max).replace("₹", "")}`;
  if (max) return money(max);
  if (min) return money(min);
  return row.currency ?? "INR";
}

function noteFor(row: CityDropRow, demand: number, target: number) {
  if (row.status === "live") return demand >= target ? "Target reached" : "Collecting demand";
  if (row.status === "artist_review") return "Artist review";
  if (row.status === "draft") return "Draft";
  if (row.status === "fulfilled") return "Completed";
  return "Newly requested";
}

function toArtistDrop(row: CityDropRow, index: number): ArtistDrop {
  const target = row.target_commitments ?? row.target_capacity ?? 50;
  const demand = Math.max(0, Math.round(target * (row.status === "live" ? 0.72 : 0.18)));
  const city = row.cities?.name ?? "City TBD";
  const venue = parseVenue(row.description, row.venue_capacity ?? row.target_capacity);

  return {
    slug: row.id,
    // Each city drop has its own event title. Use it for the drop identity so
    // multiple drops from the same artist do not all collapse to one name.
    name: row.title?.trim() || row.artist_profiles?.stage_name?.trim() || "Untitled city drop",
    genre: row.artist_profiles?.genre?.trim() || "Live event",
    demand,
    target,
    date: new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    price: priceRange(row),
    venue,
    note: noteFor(row, demand, target),
    image: fallbackImages[index % fallbackImages.length],
    description: parseDescription(row),
    city,
  };
}

const liveDropSelect = [
  "id",
  "title",
  "status",
  "target_commitments",
  "target_capacity",
  "venue_capacity",
  "min_ticket_price_minor",
  "max_ticket_price_minor",
  "currency",
  "description",
  "created_at",
  "cities(name)",
  "artist_profiles(stage_name,genre,bio)",
].join(",");

export async function getLiveDrops(limit = 24) {
  const rows = await readServiceRows<CityDropRow>(
    `/city_drops?status=in.(live,artist_review)&select=${liveDropSelect}&order=created_at.desc&limit=${limit}`,
  );
  return rows.map(toArtistDrop);
}

export async function getLiveDropById(id: string) {
  const rows = await readServiceRows<CityDropRow>(
    `/city_drops?id=eq.${encodeURIComponent(id)}&select=${liveDropSelect}&limit=1`,
  );
  const row = rows[0];
  return row ? toArtistDrop(row, 0) : null;
}
