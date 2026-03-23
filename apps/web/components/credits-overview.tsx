import { formatDateTime } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function CreditsOverview() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: balance }, { data: history }] = await Promise.all([
    supabase.rpc("get_balance", { p_user_id: user!.id }),
    supabase
      .from("credit_ledger")
      .select("id, type, amount, balance_after, description, created_at, model, tokens_used")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-line bg-panel p-8 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Credits
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          余额与账单
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Desktop 会优先读取这里的余额和账单摘要。后续充值、扣费、调用记录都围绕这条 ledger 展开。
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[1.5rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)] md:col-span-1">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Available Balance
          </div>
          <div className="mt-4 text-4xl font-semibold text-foreground">
            {typeof balance === "number" ? balance.toFixed(2) : "0.00"}
          </div>
          <div className="mt-2 text-sm text-muted">credits</div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Entries
          </div>
          <div className="mt-4 text-4xl font-semibold text-foreground">
            {(history ?? []).length}
          </div>
          <div className="mt-2 text-sm text-muted">latest billing events</div>
        </article>

        <article className="rounded-[1.5rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
          <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Latest Change
          </div>
          <div className="mt-4 text-4xl font-semibold text-foreground">
            {history?.[0] ? `${history[0].amount > 0 ? "+" : ""}${history[0].amount}` : "--"}
          </div>
          <div className="mt-2 text-sm text-muted">
            {history?.[0]?.type ?? "No recent billing records"}
          </div>
        </article>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
        <h2 className="text-xl font-semibold text-foreground">Recent Ledger</h2>
        <div className="mt-5 space-y-3">
          {(history ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-sm text-muted">
              还没有 credits 历史记录。
            </div>
          ) : (
            history?.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-line bg-white/75 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">
                      {item.description || item.type}
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {formatDateTime(item.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      {item.amount > 0 ? "+" : ""}
                      {item.amount}
                    </div>
                    <div className="text-xs text-muted">
                      balance {item.balance_after}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
