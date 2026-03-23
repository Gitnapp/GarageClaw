import { redirect } from "next/navigation";
import { MarketplaceOverview } from "@/components/marketplace-overview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EmbedMarketplacePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/embed/marketplace");
  }

  return <MarketplaceOverview />;
}
