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
      <div>
        <h1 className="text-2xl font-semibold">Agents 与 Skills 市场</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览公开的 Agent 和 Skill，Desktop 内嵌和浏览器控制台共用。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Featured Agents</h2>
          <div className="mt-4 space-y-2">
            {(agents ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                还没有公开 Agent。后续上架后会直接出现在这里。
              </div>
            ) : (
              agents?.map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {agent.pricing_type ?? "free"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground">
                    {agent.description || "正在等待补充 Agent 描述。"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {agent.model}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Skills Catalog</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(skills ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:col-span-2">
                Skills seed 还没有准备好，稍后会在这里展示。
              </div>
            ) : (
              skills?.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-md border bg-background p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{skill.name}</div>
                    <span className="text-xs text-muted-foreground">
                      {skill.is_builtin ? "builtin" : skill.category || "skill"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {skill.description || "等待补充技能说明。"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
