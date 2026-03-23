import { NextResponse } from "next/server";
import type { ApiErrorResponse, ProfileSummary } from "@garageclaw/shared/api-types";
import { resolveRequestActor } from "@/lib/auth-guard";
import { buildProfileSummary } from "@/lib/profile";

export async function GET(request: Request) {
  const actor = await resolveRequestActor(request);

  if (!actor) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const profile = await buildProfileSummary(actor);

  return NextResponse.json<ProfileSummary>(profile);
}
