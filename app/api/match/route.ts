import { NextResponse } from "next/server";
import { getMatchesForCurrentUser } from "@/lib/matching/getMatches";

export async function GET() {
  const { matches, profileCompleteness, error } = await getMatchesForCurrentUser();

  if (error === "not_authenticated") {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (error === "profile_not_found") {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  if (error) {
    return NextResponse.json({ error: "Could not compute matches." }, { status: 500 });
  }

  return NextResponse.json({ matches, profileCompleteness });
}
