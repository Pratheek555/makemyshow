import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../../_lib/auth-server";
import { getLiveDropById } from "../../../_lib/live-drops";
import { getArtistDrop } from "../../data";
import ArtistDetailClient from "./artist-detail-client";

export default async function ArtistDropPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user?.id) redirect("/login");

  const { slug } = await params;
  const artist = getArtistDrop(slug) ?? (await getLiveDropById(slug).catch(() => null));

  if (!artist) notFound();

  return <ArtistDetailClient artist={artist} />;
}
