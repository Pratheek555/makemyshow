import { NextResponse } from "next/server";
import { applySessionCookies, clearSessionCookies, getAccessToken, getMvpSessionUser, getRefreshToken } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseAuthUrl, supabaseHeaders, type SupabaseSession, type SupabaseUser } from "../../../_lib/supabase-rest";

export async function GET() {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (accessToken) {
    const userResponse = await fetch(supabaseAuthUrl("/user"), { headers: supabaseHeaders(accessToken), cache: "no-store" });
    if (userResponse.ok) return NextResponse.json({ user: (await userResponse.json()) as SupabaseUser });
  }

  const mvpUser = await getMvpSessionUser();
  if (mvpUser) return NextResponse.json({ user: mvpUser, mvpSession: true });

  if (!refreshToken) return NextResponse.json({ user: null }, { status: 401 });

  const refreshResponse = await fetch(supabaseAuthUrl("/token?grant_type=refresh_token"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  if (!refreshResponse.ok) {
    const result = NextResponse.json({ user: null, error: await readSupabaseError(refreshResponse) }, { status: 401 });
    clearSessionCookies(result);
    return result;
  }

  const session = (await refreshResponse.json()) as SupabaseSession;
  const result = NextResponse.json({ user: session.user ?? null });
  applySessionCookies(result, session);
  return result;
}
