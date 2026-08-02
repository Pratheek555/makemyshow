export type ArtistDrop = {
  slug: string;
  name: string;
  genre: string;
  demand: number;
  target: number;
  date: string;
  price: string;
  venue: string;
  note: string;
  image: string;
  description: string;
  city?: string;
};

export const artistDrops: ArtistDrop[] = [
  {
    slug: "anuv-jain",
    name: "Anuv Jain",
    genre: "Indie folk",
    demand: 166,
    target: 150,
    date: "18 Oct window",
    price: "INR 1,499-2,499",
    venue: "200-350 cap room",
    note: "Closest to viable",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=85",
    description: "An intimate city drop built for listeners who want a close room, a patient set, and a show that feels worth travelling across town for.",
  },
  {
    slug: "prateek-kuhad",
    name: "Prateek Kuhad",
    genre: "Indie pop",
    demand: 138,
    target: 220,
    date: "November window",
    price: "INR 1,999-2,999",
    venue: "400-600 cap room",
    note: "Demand building",
    image: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1400&q=85",
    description: "A bigger room is possible once the local audience clears the current threshold. Your capped commitment helps prove the routing case.",
  },
  {
    slug: "ritviz",
    name: "Ritviz",
    genre: "Electronic",
    demand: 119,
    target: 180,
    date: "23 Nov window",
    price: "INR 1,499-2,499",
    venue: "350-500 cap room",
    note: "Late-night signal",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=85",
    description: "A late-evening city drop designed around an electronic room with clear demand, reliable timing, and a concentrated fan signal.",
  },
  {
    slug: "seedhe-maut",
    name: "Seedhe Maut",
    genre: "Hip-hop",
    demand: 102,
    target: 240,
    date: "Flexible routing",
    price: "INR 1,299-2,299",
    venue: "500-700 cap room",
    note: "Newly requested",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1400&q=85",
    description: "This request is early, but the local signal is already strong enough to start building a serious city drop around it.",
  },
  {
    slug: "when-chai-met-toast",
    name: "When Chai Met Toast",
    genre: "Indie pop",
    demand: 87,
    target: 160,
    date: "December window",
    price: "INR 1,299-1,999",
    venue: "250-400 cap room",
    note: "Student favorite",
    image: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1400&q=85",
    description: "A warm, campus-friendly show concept with a smaller room, lower price ceiling, and strong early interest from student communities.",
  },
  {
    slug: "divine",
    name: "DIVINE",
    genre: "Hip-hop",
    demand: 81,
    target: 300,
    date: "Route dependent",
    price: "INR 1,999-3,499",
    venue: "700-1,000 cap room",
    note: "Early momentum",
    image: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=85",
    description: "A high-energy request that needs a larger room and a longer runway. The first commitments establish whether the market can carry it.",
  },
];

export const cities = ["Vijayawada", "Hyderabad", "Bengaluru", "Visakhapatnam", "Chennai", "Pune", "Mumbai", "Delhi", "Kolkata", "Kochi", "Jaipur", "Indore"];

export const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export const getArtistDrop = (slug: string) => artistDrops.find((artist) => artist.slug === slug);
