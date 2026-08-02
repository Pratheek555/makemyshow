import { cookies } from "next/headers";
import { supabaseAuthUrl, supabaseHeaders, type SupabaseSession, type SupabaseUser } from "./supabase-rest";

const ACCESS_COOKIE = "mms-access-token";
const REFRESH_COOKIE = "mms-refresh-token";
const EXPIRES_COOKIE = "mms-access-expires-at";

export function applySessionCookies(response: Response, session: SupabaseSession) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookieValues = [
    `${ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expires_in}${secure}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    `${EXPIRES_COOKIE}=${Date.now() + session.expires_in * 1000}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expires_in}${secure}`,
  ];
  for (const value of cookieValues) response.headers.append("Set-Cookie", value);
}

export function clearSessionCookies(response: Response) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRES_COOKIE]) {
    response.headers.append("Set-Cookie", `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }
}

export async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken() {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const response = await fetch(supabaseAuthUrl("/user"), {
    headers: supabaseHeaders(accessToken),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as SupabaseUser;
}
