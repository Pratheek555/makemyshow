import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../_lib/auth-server";
import { getLiveDrops } from "../../../_lib/live-drops";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Log in to discover live city drops." }, { status: 401 });

    const drops = await getLiveDrops();
    return NextResponse.json({ drops });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load live city drops." },
      { status: 500 },
    );
  }
}
