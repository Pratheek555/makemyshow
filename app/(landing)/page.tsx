import LandingPage from "./_components/LandingPage";
import { getCurrentUser } from "../_lib/auth-server";

export default async function Home() {
  const user = await getCurrentUser();
  return <LandingPage isLoggedIn={Boolean(user)} />;
}
