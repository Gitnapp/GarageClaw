import type { AuthenticatedActor } from "@garageclaw/shared/api-types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv } from "@/lib/env";

export async function resolveRequestActor(
  request: Request,
): Promise<AuthenticatedActor | null> {
  // 1. Try Bearer token auth
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token && hasServiceRoleEnv()) {
      return resolveTokenActor(token);
    }
  }

  // 2. Fall back to session (cookie) auth
  return resolveSessionActor();
}

async function resolveSessionActor(): Promise<AuthenticatedActor | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    email: user.email ?? null,
    id: user.id,
    source: "session",
  };
}

async function resolveTokenActor(
  token: string,
): Promise<AuthenticatedActor | null> {
  const admin = createAdminSupabaseClient();

  // Hash the token to compare with stored hash
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: row } = await admin
    .from("api_tokens")
    .select("id, user_id, name, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row) return null;

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, avatar_url, role")
    .eq("id", row.user_id)
    .maybeSingle();

  // Look up user email
  const {
    data: { user },
  } = await admin.auth.admin.getUserById(row.user_id);

  return {
    avatar_url: profile?.avatar_url ?? null,
    display_name: profile?.display_name ?? null,
    email: user?.email ?? null,
    id: row.user_id,
    role: profile?.role ?? null,
    source: "api_token",
    token_id: row.id,
    token_name: row.name,
  };
}
