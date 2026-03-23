import { redirect } from "next/navigation";
import { CreditsOverview } from "@/components/credits-overview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EmbedCreditsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/embed/credits");
  }

  return <CreditsOverview />;
}
