import { formatDateTime } from "@/lib/format";
import { buildProfileSummary } from "@/lib/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function ProfileOverview() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, profileRow, { count: tokenCount }, { data: balance }] = await Promise.all([
    buildProfileSummary({
      email: user?.email ?? null,
      id: user!.id,
      source: "session",
    }),
    supabase
      .from("profiles")
      .select("created_at")
      .eq("id", user!.id)
      .maybeSingle(),
    supabase.from("api_tokens").select("*", { count: "exact", head: true }),
    supabase.rpc("get_balance", { p_user_id: user!.id }),
  ]);

  const cards = [
    {
      label: "Display Name",
      value: profile.display_name ?? "未设置",
      detail: profile.role ?? "user",
    },
    {
      label: "Email",
      value: profile.email ?? "未设置",
      detail: "Platform identity",
    },
    {
      label: "Credits",
      value: typeof balance === "number" ? balance.toFixed(2) : "0.00",
      detail: "Available balance",
    },
    {
      label: "API Tokens",
      value: String(tokenCount ?? 0),
      detail: "Desktop / external integrations",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">账号与平台身份</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          登录状态、credits、token 以及后续设备绑定的统一来源。
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          注册时间：{formatDateTime(profileRow.data?.created_at ?? null)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </div>
            <div className="mt-3 break-words text-xl font-semibold">
              {card.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{card.detail}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Platform Notes</h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p>1. Desktop 内嵌登录与浏览器登录共享同一套 session 语义。</p>
          <p>2. 原生 desktop Profile 页会直接读取 /api/me 和 credits API 来展示摘要。</p>
          <p>3. 后续如接入设备绑定或桌面 token，也会继续从这个账号中枢扩展。</p>
        </div>
      </div>
    </div>
  );
}
