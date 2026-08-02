import { NextResponse } from "next/server";

const API_BASE_URL = process.env.PRAVA_API_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://sandbox.api.prava.space";
const INR = "INR";

type SessionRequest = {
  artist?: string;
  city?: string;
  quantity?: number;
  priceCeiling?: number;
  depositCap?: number;
  email?: string;
};

type PravaSessionResponse = {
  iframe_url?: string;
  session_id?: string;
  session_token?: string;
  expires_at?: string;
  order_id?: string;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, string>;
  };
};

function resolveMerchantUrl(request: Request) {
  const configuredUrl = process.env.PRAVA_MERCHANT_URL?.trim();
  const requestOrigin = new URL(request.url).origin;

  if (!configuredUrl || configuredUrl.includes("your-promoter-domain.example")) {
    return requestOrigin;
  }

  return configuredUrl;
}

export async function POST(request: Request) {
  const secretKey = process.env.PRAVA_SECRET_KEY || process.env.MERCHANT_SECRET_KEY;
  const merchantName = process.env.PRAVA_MERCHANT_NAME || "MakeMyShow";
  const merchantUrl = resolveMerchantUrl(request);
  const merchantCountry = process.env.PRAVA_MERCHANT_COUNTRY || "IN";

  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          "Prava is not configured yet. Add PRAVA_SECRET_KEY or MERCHANT_SECRET_KEY to enable live authorization.",
      },
      { status: 503 },
    );
  }

  let body: SessionRequest;

  try {
    body = (await request.json()) as SessionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim();
  const artist = body.artist?.trim() || "Anuv Jain";
  const { city, quantity, priceCeiling, depositCap } = body;

  if (
    !city ||
    !email ||
    !email.includes("@") ||
    artist.length > 100 ||
    typeof quantity !== "number" ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 8 ||
    typeof priceCeiling !== "number" ||
    priceCeiling < 499 ||
    priceCeiling > 10000 ||
    typeof depositCap !== "number" ||
    depositCap <= 0
  ) {
    return NextResponse.json({ error: "Please check your city, ticket choices, and email." }, { status: 400 });
  }

  const expectedCap = Math.round(priceCeiling * quantity * 0.3);

  if (depositCap !== expectedCap) {
    return NextResponse.json({ error: "The authorization cap did not match the ticket commitment." }, { status: 400 });
  }

  const artistReference = artist.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cityReference = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const campaignReference = `mms-${artistReference}-${cityReference}-${crypto.randomUUID()}`;
  const productReference = `mms-${crypto.randomUUID()}`;
  const description = `30% capped authorization for ${artist} in ${city}. No charge until artist acceptance.`;
  const amount = depositCap.toFixed(2);
  const payload = {
    user_id: `fan-${crypto.randomUUID()}`,
    user_email: email,
    total_amount: amount,
    currency: INR,
    description,
    purchase_context: [
      {
        merchant_details: {
          name: merchantName,
          url: merchantUrl,
          country_code_iso2: merchantCountry,
          category_code: "7922",
          category: "Live events",
        },
        product_details: [
          {
            description: `${artist} City Drop, ${city}, ${quantity} ticket commitment${quantity > 1 ? "s" : ""}`,
            unit_price: amount,
            quantity: 1,
            product_id: productReference,
          },
        ],
        effective_until_minutes: 10080,
      },
    ],
    integration_type: "embedding",
    external_order_ref: campaignReference,
    mandate_setup: {
      intent: "mandate_setup",
      recurring_frequency: "one_time",
      merchant_scope: "listed",
      max_charges: 1,
    },
  };

  try {
    const pravaResponse = await fetch(`${API_BASE_URL}/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const pravaData = (await pravaResponse.json()) as PravaSessionResponse;

    if (!pravaResponse.ok || !pravaData.iframe_url || !pravaData.session_id || !pravaData.session_token) {
      const responseId = pravaResponse.headers.get("x-response-id");
      const message = pravaData.error?.message || "Prava could not create a secure authorization session.";

      // Keep Prava's support reference in server logs without ever logging the key or customer data.
      console.error("Prava session creation failed", {
        status: pravaResponse.status,
        responseId,
        code: pravaData.error?.code,
        message,
        details: pravaData.error?.details,
      });

      return NextResponse.json(
        {
          error: message,
          code: pravaData.error?.code,
          reference: responseId,
        },
        { status: pravaResponse.status || 502 },
      );
    }

    return NextResponse.json({
      sessionId: pravaData.session_id,
      sessionToken: pravaData.session_token,
      iframeUrl: pravaData.iframe_url,
      orderId: pravaData.order_id,
      expiresAt: pravaData.expires_at,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Prava. Please try again shortly." },
      { status: 502 },
    );
  }
}
