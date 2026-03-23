import { NextResponse } from "next/server";
import type {
  ApiErrorResponse,
  CreditBalanceResponse,
} from "@garageclaw/shared/api-types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasServiceRoleEnv, hasSupabaseEnv } from "@/lib/env";
import { resolveRequestActor } from "@/lib/auth-guard";

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

  if (!hasServiceRoleEnv()) {
    return NextResponse.json<ApiErrorResponse & { message: string }>(
      {
        error: "internal_error",
        message: "SUPABASE_SERVICE_ROLE_KEY is required to resolve credit balance.",
      },
      { status: 503 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("get_balance", {
    p_user_id: actor.id,
  });

  if (error) {
    return NextResponse.json<ApiErrorResponse & { message: string }>(
      {
        error: "internal_error",
        message: error.message,
      },
      { status: 500 },
    );
  }

  const response: CreditBalanceResponse = {
    balance: typeof data === "number" ? data : 0,
    currency: "credits",
  };

  return NextResponse.json<CreditBalanceResponse>(response);
}
