import { notFound } from "next/navigation";
import { getArtistDrop } from "../../data";
import ArtistDetailClient from "./artist-detail-client";

export default async function ArtistDropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artist = getArtistDrop(slug);

  if (!artist) notFound();

  return <ArtistDetailClient artist={artist} />;
}
