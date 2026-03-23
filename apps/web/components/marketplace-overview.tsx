import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function MarketplaceOverview() {
  const supabase = await createServerSupabaseClient();
  const [{ data: agents }, { data: skills }] = await Promise.all([
    supabase
      .from("agents")
      .select("id, name, description, model, pricing_type")
      .eq("is_public", true)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("skills")
      .select("id, name, description, category, is_builtin")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-line bg-panel p-8 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
          Marketplace
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          Agents 与 Skills 市场
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          这里是给 desktop 嵌入和浏览器控制台共用的市场入口。当前先打通浏览、登录态复用和后续 credits / invoke 的衔接位。
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-line bg-white/75 p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
          <h2 className="text-xl font-semibold text-foreground">Featured Agents</h2>
          <div className="mt-5 grid gap-3">
            {(agents ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-sm text-muted">
                还没有公开 Agent。后续上架后会直接出现在这里。
              </div>
            ) : (
              agents?.map((agent) => (
                <article
                  key={agent.id}
                  className="rounded-2xl border border-line bg-white px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{agent.name}</div>
                    <div className="rounded-full bg-[#f8efe4] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                      {agent.pricing_type ?? "free"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted">
                    {agent.description || "正在等待补充 Agent 描述。"}
                  </div>
                  <div className="mt-3 text-xs font-mono uppercase tracking-[0.14em] text-muted">
                    {agent.model}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-panel p-6 shadow-[0_16px_45px_rgba(20,33,43,0.05)]">
          <h2 className="text-xl font-semibold text-foreground">Skills Catalog</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(skills ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white/60 px-4 py-5 text-sm text-muted sm:col-span-2">
                Skills seed 还没有准备好，稍后会在这里展示。
              </div>
            ) : (
              skills?.map((skill) => (
                <article
                  key={skill.id}
                  className="rounded-2xl border border-line bg-white/75 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-foreground">{skill.name}</div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted">
                      {skill.is_builtin ? "builtin" : skill.category || "skill"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted">
                    {skill.description || "等待补充技能说明。"}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
