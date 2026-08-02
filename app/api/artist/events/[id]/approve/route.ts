import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../_lib/auth-server";
import { readSupabaseError, supabaseRestUrl, supabaseServiceHeaders } from "../../../../../_lib/supabase-rest";

const API_BASE_URL = process.env.PRAVA_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://sandbox.api.prava.space";
const idPattern = /^[a-zA-Z0-9_-]{8,200}$/;

async function readRows<T>(path: string): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), { headers: supabaseServiceHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

async function patchRows<T>(path: string, body: unknown): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), {
    method: "PATCH",
    headers: { ...supabaseServiceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

type MandateRow = { id: number; prava_mandate_id: string | null; deposit_cap_minor: number; status: string; artist_name: string; city: string };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Log in as an artist first." }, { status: 401 });
    const { id } = await params;
    if (!idPattern.test(id)) return NextResponse.json({ error: "Invalid event id." }, { status: 400 });

    const artists = await readRows<{ id: string }>(`/artist_profiles?owner_user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    const artistId = artists[0]?.id;
    if (!artistId) return NextResponse.json({ error: "Artist profile was not found." }, { status: 404 });

    const drops = await readRows<{ id: string; status: string }>(`/city_drops?id=eq.${encodeURIComponent(id)}&artist_id=eq.${encodeURIComponent(artistId)}&select=id,status&limit=1`);
    if (!drops[0]) return NextResponse.json({ error: "This event is not owned by your artist profile." }, { status: 403 });
    if (drops[0].status === "live") return NextResponse.json({ ok: true, alreadyLive: true, requested: 0, charged: 0 });

    await patchRows(`/city_drops?id=eq.${encodeURIComponent(id)}`, { status: "live", updated_at: new Date().toISOString() });

    const mandates = await readRows<MandateRow>(`/fan_mandates?city_drop_id=eq.${encodeURIComponent(id)}&status=eq.authorized&select=id,prava_mandate_id,deposit_cap_minor,status,artist_name,city&order=created_at.asc`);
    const secretKey = process.env.PRAVA_SECRET_KEY || process.env.MERCHANT_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ ok: true, requested: mandates.length, charged: 0, pendingSettlement: mandates.length, warning: "Event is live. Add Prava secret configuration to request mandate charges." });

    let pendingSettlement = 0;
    for (const mandate of mandates) {
      if (!mandate.prava_mandate_id) {
        await patchRows(`/fan_mandates?id=eq.${mandate.id}`, { status: "failed", prava_result: { error: "Prava mandate reference was not found." }, updated_at: new Date().toISOString() });
        continue;
      }
      const reference = `mms-drop-${id}-mandate-${mandate.id}`;
      const chargeResponse = await fetch(`${API_BASE_URL}/v1/mandates/${encodeURIComponent(mandate.prava_mandate_id)}/charge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: (mandate.deposit_cap_minor / 100).toFixed(2), reference }),
        cache: "no-store",
      });
      const charge = (await chargeResponse.json()) as { transactionId?: string; status?: string; fetchStatus?: string; errorCode?: string; errorMessage?: string; credentials?: unknown };
      const safeCharge = { transactionId: charge.transactionId, status: charge.status, fetchStatus: charge.fetchStatus, errorCode: charge.errorCode, errorMessage: charge.errorMessage };
      if (!chargeResponse.ok || charge.status === "failed") {
        await patchRows(`/fan_mandates?id=eq.${mandate.id}`, { status: "failed", prava_charge_id: charge.transactionId ?? null, prava_result: safeCharge, updated_at: new Date().toISOString() });
        continue;
      }
      pendingSettlement += 1;
      await patchRows(`/fan_mandates?id=eq.${mandate.id}`, { status: "artist_approved", prava_charge_id: charge.transactionId ?? null, prava_result: safeCharge, updated_at: new Date().toISOString() });
    }

    return NextResponse.json({ ok: true, requested: mandates.length, charged: 0, pendingSettlement });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve this event." }, { status: 500 });
  }
}
