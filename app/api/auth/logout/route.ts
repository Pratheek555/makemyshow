import { NextResponse } from "next/server";
import { clearSessionCookies, getAccessToken } from "../../../_lib/auth-server";
import { supabaseAuthUrl, supabaseHeaders } from "../../../_lib/supabase-rest";

export async function POST() {
  const accessToken = await getAccessToken();
  if (accessToken) {
    await fetch(supabaseAuthUrl("/logout"), { method: "POST", headers: supabaseHeaders(accessToken), cache: "no-store" }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
