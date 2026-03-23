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
      <div>
        <h1 className="text-2xl font-semibold">余额与账单</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          查看 credits 余额、充值记录和调用消耗明细。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Available Balance
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {typeof balance === "number" ? balance.toFixed(2) : "0.00"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">credits</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Entries
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {(history ?? []).length}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">latest billing events</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Latest Change
          </div>
          <div className="mt-3 text-3xl font-semibold">
            {history?.[0] ? `${history[0].amount > 0 ? "+" : ""}${history[0].amount}` : "--"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {history?.[0]?.type ?? "No recent billing records"}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent Ledger</h2>
        <div className="mt-4 space-y-2">
          {(history ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              还没有 credits 历史记录。
            </div>
          ) : (
            history?.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
              >
                <div>
                  <div className="text-sm font-medium">
                    {item.description || item.type}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {item.amount > 0 ? "+" : ""}
                    {item.amount}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    balance {item.balance_after}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
