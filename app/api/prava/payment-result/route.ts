import { NextResponse } from "next/server";

const API_BASE_URL = process.env.PRAVA_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://sandbox.api.prava.space";

type PravaPaymentResult = {
  session_id?: string;
  order_id?: string | null;
  status?: "pending" | "completed" | "failed" | string;
  transactions?: Array<{
    status?: string;
    error?: { message?: string };
  }>;
  error?: { message?: string };
};

export async function GET(request: Request) {
  const secretKey = process.env.PRAVA_SECRET_KEY || process.env.MERCHANT_SECRET_KEY;
  const sessionId = new URL(request.url).searchParams.get("sessionId");

  if (!secretKey) {
    return NextResponse.json({ error: "Prava is not configured yet." }, { status: 503 });
  }

  if (!sessionId || !/^[a-zA-Z0-9_-]{8,200}$/.test(sessionId)) {
    return NextResponse.json({ error: "A valid Prava session id is required." }, { status: 400 });
  }

  try {
    const pravaResponse = await fetch(`${API_BASE_URL}/v1/sessions/${encodeURIComponent(sessionId)}/payment-result?_t=${Date.now()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    });

    const pravaData = (await pravaResponse.json()) as PravaPaymentResult;

    if (!pravaResponse.ok) {
      return NextResponse.json(
        { error: pravaData.error?.message || "Prava could not retrieve the payment result." },
        { status: pravaResponse.status || 502 },
      );
    }

    const firstTransaction = pravaData.transactions?.[0];

    return NextResponse.json({
      sessionId: pravaData.session_id || sessionId,
      orderId: pravaData.order_id || null,
      status: pravaData.status || "pending",
      transactionStatus: firstTransaction?.status || null,
      error: firstTransaction?.error?.message || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Prava. Please try again shortly." },
      { status: 502 },
    );
  }
}
