import { NextResponse } from "next/server";
import { applySessionCookies } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseAuthUrl, supabaseHeaders, type SupabaseSession } from "../../../_lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  const response = await fetch(supabaseAuthUrl("/token?grant_type=password"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) return NextResponse.json({ error: await readSupabaseError(response) }, { status: response.status });

  const session = (await response.json()) as SupabaseSession;
  const result = NextResponse.json({ ok: true });
  applySessionCookies(result, session);
  return result;
}
