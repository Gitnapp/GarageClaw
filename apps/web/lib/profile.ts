import type { AuthenticatedActor, ProfileSummary } from "@garageclaw/shared/api-types";
import type { Database } from "@garageclaw/shared/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export async function getProfileForActor(
  actor: AuthenticatedActor,
): Promise<ProfileRow | null> {
  if (actor.source === "session") {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, role, created_at")
      .eq("id", actor.id)
      .maybeSingle();
    return data ?? null;
  }

  if (!hasServiceRoleEnv()) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url, role, created_at")
    .eq("id", actor.id)
    .maybeSingle();
  return data ?? null;
}

export async function buildProfileSummary(
  actor: AuthenticatedActor,
): Promise<ProfileSummary> {
  const profile = await getProfileForActor(actor);

  return {
    ...actor,
    avatar_url: profile?.avatar_url ?? null,
    display_name: profile?.display_name ?? actor.email ?? null,
    role: profile?.role ?? actor.role ?? null,
  };
}
