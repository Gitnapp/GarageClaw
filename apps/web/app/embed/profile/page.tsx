import { redirect } from "next/navigation";
import { ProfileOverview } from "@/components/profile-overview";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EmbedProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/embed/profile");
  }

  return <ProfileOverview />;
}
