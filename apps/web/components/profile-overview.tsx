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
      <section className="rounded-[2rem] border border-line bg-panel p-8 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Profile
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          账号与平台身份
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          这个页面会被 desktop 原生 Profile 页复用，作为登录状态、credits、token 以及后续设备绑定的统一来源。
        </p>
        <div className="mt-6 text-sm text-muted">
          注册时间：{formatDateTime(profileRow.data?.created_at ?? null)}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-[1.5rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]"
          >
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              {card.label}
            </div>
            <div className="mt-4 break-words text-2xl font-semibold text-foreground">
              {card.value}
            </div>
            <div className="mt-2 text-sm text-muted">{card.detail}</div>
          </article>
        ))}
      </section>

      <section className="rounded-[1.75rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
        <h2 className="text-xl font-semibold text-foreground">Platform Notes</h2>
        <div className="mt-4 grid gap-3 text-sm leading-7 text-muted">
          <p>1. Desktop 内嵌登录与浏览器登录共享同一套 session 语义。</p>
          <p>2. 原生 desktop Profile 页会直接读取 `/api/me` 和 credits API 来展示摘要。</p>
          <p>3. 后续如接入设备绑定或桌面 token，也会继续从这个账号中枢扩展。</p>
        </div>
      </section>
    </div>
  );
}
