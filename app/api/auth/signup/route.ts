import { NextResponse } from "next/server";
import { applySessionCookies } from "../../../_lib/auth-server";
import { readSupabaseError, supabaseAuthUrl, supabaseHeaders, supabaseRestUrl, supabaseServiceHeaders, type SupabaseSession, type SupabaseUser } from "../../../_lib/supabase-rest";

type ArtistSignupProfile = {
  artistName?: string;
  representativeRole?: string;
  category?: string;
  baseCity?: string;
  socialLink?: string;
};

type SignupBody = {
  name?: string;
  email?: string;
  password?: string;
  accountType?: "fan" | "artist";
  artistProfile?: ArtistSignupProfile;
};

async function writeServiceRow<T>(path: string, body: unknown, prefer = "return=minimal"): Promise<T | null> {
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
  if (response.status === 204 || prefer.includes("return=minimal")) return null;
  return (await response.json()) as T;
}

async function readServiceRows<T>(path: string): Promise<T[]> {
  const response = await fetch(supabaseRestUrl(path), {
    headers: supabaseServiceHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as T[];
}

async function patchServiceRow(path: string, body: unknown) {
  const response = await fetch(supabaseRestUrl(path), {
    method: "PATCH",
    headers: {
      ...supabaseServiceHeaders(),
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readSupabaseError(response));
}

async function createOrUpdateConfirmedUser(email: string, password: string, metadata: SupabaseUser["user_metadata"]): Promise<SupabaseUser> {
  const createResponse = await fetch(supabaseAuthUrl("/admin/users"), {
    method: "POST",
    headers: supabaseServiceHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
    cache: "no-store",
  });

  if (createResponse.ok) return (await createResponse.json()) as SupabaseUser;

  const createError = await readSupabaseError(createResponse);
  if (!/already|registered|exists/i.test(createError)) throw new Error(createError);

  const usersResponse = await fetch(supabaseAuthUrl("/admin/users?page=1&per_page=200"), {
    headers: supabaseServiceHeaders(),
    cache: "no-store",
  });
  if (!usersResponse.ok) throw new Error(await readSupabaseError(usersResponse));

  const usersData = (await usersResponse.json()) as { users?: SupabaseUser[] };
  const existingUser = usersData.users?.find((user) => user.email?.toLowerCase() === email);
  if (!existingUser?.id) throw new Error("This email already exists, but the user could not be found for the MVP update.");

  const updateResponse = await fetch(supabaseAuthUrl(`/admin/users/${existingUser.id}`), {
    method: "PUT",
    headers: supabaseServiceHeaders(),
    body: JSON.stringify({
      password,
      email_confirm: true,
      user_metadata: metadata,
    }),
    cache: "no-store",
  });
  if (!updateResponse.ok) throw new Error(await readSupabaseError(updateResponse));
  return (await updateResponse.json()) as SupabaseUser;
}

async function signIn(email: string, password: string) {
  const response = await fetch(supabaseAuthUrl("/token?grant_type=password"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(await readSupabaseError(response));
  return (await response.json()) as SupabaseSession;
}

async function persistFanSignup(userId: string, name: string) {
  await writeServiceRow(
    "/profiles?on_conflict=id",
    {
      id: userId,
      display_name: name,
    },
    "resolution=merge-duplicates,return=minimal",
  );
}

async function persistArtistSignup(userId: string, name: string, artistProfile: ArtistSignupProfile) {
  await writeServiceRow(
    "/profiles?on_conflict=id",
    {
      id: userId,
      display_name: name,
    },
    "resolution=merge-duplicates,return=minimal",
  );

  await writeServiceRow(
    "/account_roles?on_conflict=user_id,role",
    {
      user_id: userId,
      role: "artist",
    },
    "resolution=merge-duplicates,return=minimal",
  );

  const existingArtists = await readServiceRows<Array<{ id: string }>[number]>(`/artist_profiles?owner_user_id=eq.${userId}&select=id&limit=1`);
  let artistId: string | null = existingArtists[0]?.id ?? null;

  if (artistId) {
    await patchServiceRow(`/artist_profiles?id=eq.${artistId}`, {
      stage_name: artistProfile.artistName?.trim(),
      genre: artistProfile.category?.trim() || null,
      bio: artistProfile.socialLink?.trim() ? `Proof link: ${artistProfile.socialLink.trim()}` : null,
      status: "draft",
      updated_at: new Date().toISOString(),
    });
  } else {
    const artistRows = await writeServiceRow<Array<{ id: string }>>(
      "/artist_profiles",
      {
        owner_user_id: userId,
        stage_name: artistProfile.artistName?.trim(),
        genre: artistProfile.category?.trim() || null,
        bio: artistProfile.socialLink?.trim() ? `Proof link: ${artistProfile.socialLink.trim()}` : null,
        status: "draft",
      },
      "return=representation",
    );
    artistId = artistRows?.[0]?.id ?? null;
  }

  if (!artistId) throw new Error("Artist profile was not returned after insert.");

  await writeServiceRow(
    "/artist_members?on_conflict=artist_id,user_id",
    {
      artist_id: artistId,
      user_id: userId,
      role: artistProfile.representativeRole === "Artist manager" ? "manager" : "owner",
    },
    "resolution=merge-duplicates,return=minimal",
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const accountType = body?.accountType === "artist" ? "artist" : "fan";
  const artistProfile = body?.artistProfile;

  if (!name || !email || !password || password.length < 8) {
    return NextResponse.json({ error: "Please provide a name, valid email, and password with at least 8 characters." }, { status: 400 });
  }

  if (accountType !== "artist") {
    try {
      const user = await createOrUpdateConfirmedUser(email, password, {
        display_name: name,
        account_type: "fan",
      });
      if (!user.id) throw new Error("Supabase did not return a user id.");
      await persistFanSignup(user.id, name);
      const session = await signIn(email, password);
      const result = NextResponse.json({ ok: true, accountStatus: "active" });
      applySessionCookies(result, session);
      return result;
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Signup could not be saved to Supabase." }, { status: 500 });
    }
  }

  const hasArtistBasics = artistProfile?.artistName?.trim() && artistProfile.representativeRole?.trim() && artistProfile.category?.trim() && artistProfile.baseCity?.trim() && artistProfile.socialLink?.trim();
  if (!hasArtistBasics) {
    return NextResponse.json({ error: "Please complete the artist profile basics before submitting." }, { status: 400 });
  }
  const validatedArtistProfile = artistProfile as ArtistSignupProfile;

  try {
    const user = await createOrUpdateConfirmedUser(email, password, {
      display_name: name,
      account_type: "artist",
      artist_profile: {
        artist_name: validatedArtistProfile.artistName?.trim(),
        representative_role: validatedArtistProfile.representativeRole?.trim(),
        category: validatedArtistProfile.category?.trim(),
        base_city: validatedArtistProfile.baseCity?.trim(),
        social_link: validatedArtistProfile.socialLink?.trim(),
        verification_status: "pending_review",
        db_persisted: true,
      },
    });
    if (!user.id) throw new Error("Supabase did not return a user id.");
    await persistArtistSignup(user.id, name, validatedArtistProfile);
    const session = await signIn(email, password);
    const result = NextResponse.json({ ok: true, accountStatus: "pending_review" });
    applySessionCookies(result, session);
    return result;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Artist signup could not be saved to Supabase." }, { status: 500 });
  }
}
