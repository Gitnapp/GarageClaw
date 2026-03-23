export function hasSupabaseEnv(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasServiceRoleEnv(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
