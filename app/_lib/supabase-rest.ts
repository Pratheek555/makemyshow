const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are not configured.");
}

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: { display_name?: string };
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: SupabaseUser;
};

export function supabaseAuthUrl(path: string) {
  return `${supabaseUrl}/auth/v1${path}`;
}

export function supabaseRestUrl(path: string) {
  return `${supabaseUrl}/rest/v1${path}`;
}

export function supabaseHeaders(accessToken?: string) {
  return {
    apikey: supabaseKey,
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function readSupabaseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { msg?: string; message?: string; error_description?: string } | null;
  return body?.msg || body?.message || body?.error_description || "Supabase request failed.";
}
