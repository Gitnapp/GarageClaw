import { NextResponse } from "next/server";
import type {
  ApiErrorResponse,
  CreditHistoryItem,
} from "@garageclaw/shared/api-types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv, hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveRequestActor } from "@/lib/auth-guard";

function sanitizeLimit(rawLimit: string | null): number {
  const parsed = Number.parseInt(rawLimit ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
}

export async function GET(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json<ApiErrorResponse & { message: string }>(
      { error: "internal_error", message: "Supabase environment is not configured." },
      { status: 503 },
    );
  }

  const actor = await resolveRequestActor(request);

  if (!actor) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "unauthorized" },
      { status: 401 },
    );
  }

  const limit = sanitizeLimit(new URL(request.url).searchParams.get("limit"));

  const query = actor.source === "session"
    ? (await createServerSupabaseClient())
        .from("credit_ledger")
        .select("id, type, amount, balance_after, description, created_at, model, tokens_used, agent_id")
        .eq("user_id", actor.id)
        .order("created_at", { ascending: false })
        .limit(limit)
    : hasServiceRoleEnv()
      ? createAdminSupabaseClient()
          .from("credit_ledger")
          .select("id, type, amount, balance_after, description, created_at, model, tokens_used, agent_id")
          .eq("user_id", actor.id)
          .order("created_at", { ascending: false })
          .limit(limit)
      : null;

  if (!query) {
    return NextResponse.json<ApiErrorResponse & { message: string }>(
      {
        error: "internal_error",
        message: "SUPABASE_SERVICE_ROLE_KEY is required to resolve token-auth credit history.",
      },
      { status: 503 },
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json<ApiErrorResponse & { message: string }>(
      {
        error: "internal_error",
        message: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json<CreditHistoryItem[]>(data ?? []);
}
