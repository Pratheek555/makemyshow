import { NextResponse } from "next/server";
import { applySessionCookies } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseAuthUrl, supabaseHeaders, type SupabaseSession } from "../../../_lib/supabase-rest";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!name || !email || !password || password.length < 8) {
    return NextResponse.json({ error: "Please provide a name, valid email, and password with at least 8 characters." }, { status: 400 });
  }

  const response = await fetch(supabaseAuthUrl("/signup"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password, data: { display_name: name } }),
  });

  if (!response.ok) return NextResponse.json({ error: await readSupabaseError(response) }, { status: response.status });

  const data = (await response.json()) as SupabaseSession;
  const result = NextResponse.json({ ok: true, requiresEmailConfirmation: !data.access_token });
  if (data.access_token) applySessionCookies(result, data);
  return result;
}
