import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseRestUrl, supabaseServiceHeaders } from "../../../_lib/supabase-rest";

const API_BASE_URL = process.env.PRAVA_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://sandbox.api.prava.space";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MandateRequest = {
  sessionId?: string;
  orderId?: string | null;
  artistSlug?: string;
  artistName?: string;
  city?: string;
  quantity?: number;
  priceCeiling?: number;
  depositCap?: number;
};

type PravaPaymentResult = {
  session_id?: string;
  order_id?: string | null;
  status?: "pending" | "completed" | "failed" | string;
  transactions?: Array<{
    txn_id?: string;
    status?: string;
    error?: { message?: string };
  }>;
  error?: { message?: string };
};

type PravaMandate = {
  id?: string;
  status?: string;
  approvedAmount?: string;
  merchantName?: string;
  createdAt?: string;
};

async function readPravaResult(sessionId: string) {
  const secretKey = process.env.PRAVA_SECRET_KEY || process.env.MERCHANT_SECRET_KEY;
  if (!secretKey) throw new Error("Prava is not configured yet.");

  const response = await fetch(`${API_BASE_URL}/v1/sessions/${encodeURIComponent(sessionId)}/payment-result?_t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: "no-store",
  });
  const data = (await response.json()) as PravaPaymentResult;

  if (!response.ok) throw new Error(data.error?.message || "Prava could not retrieve the payment result.");
  return data;
}

async function findPravaMandate(userId: string, depositCap: number) {
  const secretKey = process.env.PRAVA_SECRET_KEY || process.env.MERCHANT_SECRET_KEY;
  if (!secretKey) return null;
  const url = `${API_BASE_URL}/v1/mandates?customer_id=${encodeURIComponent(userId)}&standing_only=true`;
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" });
    const data = (await response.json()) as { mandates?: PravaMandate[]; error?: { message?: string } };
    if (!response.ok) {
      console.warn("Prava mandate lookup did not complete; saving the verified session without a mandate id.", { status: response.status, message: data.error?.message });
      return null;
    }
    const expectedAmount = depositCap.toFixed(2);
    return (data.mandates ?? [])
      .filter((mandate) => mandate.status === "active" && mandate.approvedAmount === expectedAmount)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function writeServiceRow<T>(path: string, body: unknown, prefer = "resolution=merge-duplicates,return=representation"): Promise<T> {
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
  return (await response.json()) as T;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id || !uuidPattern.test(user.id)) {
      return NextResponse.json({ error: "Log in as a fan before recording a mandate." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as MandateRequest | null;
    const sessionId = body?.sessionId?.trim();
    const artistName = body?.artistName?.trim();
    const city = body?.city?.trim();
    const quantity = body?.quantity;
    const priceCeiling = body?.priceCeiling;
    const depositCap = body?.depositCap;

    if (
      !sessionId ||
      !/^[a-zA-Z0-9_-]{8,200}$/.test(sessionId) ||
      !artistName ||
      !city ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 8 ||
      typeof priceCeiling !== "number" ||
      priceCeiling <= 0 ||
      typeof depositCap !== "number" ||
      depositCap <= 0
    ) {
      return NextResponse.json({ error: "Mandate details are incomplete." }, { status: 400 });
    }

    const expectedCap = Math.round(priceCeiling * quantity * 0.3);
    if (depositCap !== expectedCap) {
      return NextResponse.json({ error: "The mandate cap does not match the selected ticket terms." }, { status: 400 });
    }

    const pravaResult = await readPravaResult(sessionId);
    if (pravaResult.status !== "completed") {
      return NextResponse.json({ error: "Prava has not completed this mandate yet.", status: pravaResult.status || "pending" }, { status: 409 });
    }

    const artistSlug = body?.artistSlug?.trim() || null;
    const cityDropId = artistSlug && uuidPattern.test(artistSlug) ? artistSlug : null;
    const pravaUserId = user.id;
    const pravaMandateId = await findPravaMandate(pravaUserId, depositCap);
    const rows = await writeServiceRow<Array<{ id: number }>>(
      "/fan_mandates?on_conflict=prava_session_id",
      {
        fan_user_id: user.id,
        city_drop_id: cityDropId,
        drop_slug: artistSlug,
        artist_name: artistName,
        city,
        quantity,
        price_ceiling_minor: Math.round(priceCeiling * 100),
        deposit_cap_minor: Math.round(depositCap * 100),
        currency: "INR",
        prava_session_id: sessionId,
        prava_order_id: body?.orderId || pravaResult.order_id || null,
        prava_user_id: pravaUserId,
        prava_mandate_id: pravaMandateId,
        status: "authorized",
        prava_result: pravaResult,
        updated_at: new Date().toISOString(),
      },
    );

    return NextResponse.json({ ok: true, mandateId: rows[0]?.id ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record the mandate." },
      { status: 500 },
    );
  }
}
