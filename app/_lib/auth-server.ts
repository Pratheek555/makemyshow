import { cookies } from "next/headers";
import { supabaseAuthUrl, supabaseHeaders, type SupabaseSession, type SupabaseUser } from "./supabase-rest";

const ACCESS_COOKIE = "mms-access-token";
const REFRESH_COOKIE = "mms-refresh-token";
const EXPIRES_COOKIE = "mms-access-expires-at";
const MVP_SESSION_COOKIE = "mms-mvp-user";

export type MvpSessionInput = {
  name: string;
  email: string;
  accountType?: "fan" | "artist";
  artistProfile?: {
    artistName?: string;
    representativeRole?: string;
    category?: string;
    baseCity?: string;
    socialLink?: string;
  };
};

export function applySessionCookies(response: Response, session: SupabaseSession) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookieValues = [
    `${ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expires_in}${secure}`,
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    `${EXPIRES_COOKIE}=${Date.now() + session.expires_in * 1000}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.expires_in}${secure}`,
  ];
  for (const value of cookieValues) response.headers.append("Set-Cookie", value);
}

export function createMvpUser(input: MvpSessionInput): SupabaseUser {
  const accountType = input.accountType === "artist" ? "artist" : "fan";
  return {
    id: `mvp-${Buffer.from(input.email).toString("base64url")}`,
    email: input.email,
    user_metadata: {
      display_name: input.name,
      account_type: accountType,
      artist_profile:
        accountType === "artist"
          ? {
              artist_name: input.artistProfile?.artistName?.trim(),
              representative_role: input.artistProfile?.representativeRole?.trim(),
              category: input.artistProfile?.category?.trim(),
              base_city: input.artistProfile?.baseCity?.trim(),
              social_link: input.artistProfile?.socialLink?.trim(),
              verification_status: "pending_review",
              db_persisted: false,
            }
          : undefined,
    },
  };
}

export function applyMvpSessionCookie(response: Response, user: SupabaseUser) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const value = Buffer.from(JSON.stringify(user)).toString("base64url");
  response.headers.append("Set-Cookie", `${MVP_SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`);
}

export function clearSessionCookies(response: Response) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRES_COOKIE, MVP_SESSION_COOKIE]) {
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

export async function getMvpSessionUser(): Promise<SupabaseUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(MVP_SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as SupabaseUser;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SupabaseUser | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return getMvpSessionUser();

  const response = await fetch(supabaseAuthUrl("/user"), {
    headers: supabaseHeaders(accessToken),
    cache: "no-store",
  });
  if (!response.ok) return getMvpSessionUser();
  return (await response.json()) as SupabaseUser;
}
